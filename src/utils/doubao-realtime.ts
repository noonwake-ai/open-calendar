/**
 * 豆包端到端实时语音大模型客户端
 * 通过 nginx WebSocket 反向代理连接火山引擎 Realtime API
 * nginx 负责注入认证 Headers（浏览器 WebSocket 不支持自定义 Headers）
 */

// 通过 nginx 代理连接，认证 Headers 由 nginx 注入
function getWsUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}/doubao-realtime`
}

// ─── 事件 ID ───

const ClientEvent = {
    StartConnection: 1,
    FinishConnection: 2,
    StartSession: 100,
    FinishSession: 102,
    TaskRequest: 200,     // 上传音频
    EndASR: 400,          // push_to_talk 模式下通知音频结束
    ChatTTSText: 500,
} as const

const ServerEvent = {
    ConnectionStarted: 50,
    ConnectionFailed: 51,
    SessionStarted: 150,
    SessionFinished: 152,
    SessionFailed: 153,
    TTSSentenceStart: 350,
    TTSSentenceEnd: 351,
    TTSResponse: 352,
    TTSEnded: 359,
    ASRInfo: 450,
    ASRResponse: 451,
    ASREnded: 459,
    ChatResponse: 550,
    ChatEnded: 559,
} as const

// ─── 二进制协议编解码 ───

// Message Type
const MSG_FULL_CLIENT = 0b0001
const MSG_FULL_SERVER = 0b1001
const MSG_AUDIO_CLIENT = 0b0010
const MSG_AUDIO_SERVER = 0b1011
const MSG_ERROR = 0b1111

// Serialization
const SERIAL_RAW = 0b0000
const SERIAL_JSON = 0b0001

// Compression
const COMPRESS_NONE = 0b0000

/**
 * 构建客户端文本事件帧（带 event ID，可选 session ID）
 */
function buildTextEventFrame(eventId: number, payload: object | null, sessionId?: string): ArrayBuffer {
    const payloadStr = payload ? JSON.stringify(payload) : '{}'
    const payloadBytes = new TextEncoder().encode(payloadStr)

    // flags: 0b0100 表示携带 event ID
    const flags = 0b0100
    const hasSession = !!sessionId
    const sessionBytes = hasSession ? new TextEncoder().encode(sessionId) : new Uint8Array(0)

    // 计算总长度: header(4) + event(4) + [sessionIdSize(4) + sessionId] + payloadSize(4) + payload
    let size = 4 + 4  // header + event
    if (hasSession) {
        size += 4 + sessionBytes.length
    }
    size += 4 + payloadBytes.length

    const buf = new ArrayBuffer(size)
    const view = new DataView(buf)
    let offset = 0

    // Byte 0: protocol version(0001) | header size(0001)
    view.setUint8(offset++, 0x11)
    // Byte 1: message type(0001) | flags(0100)
    view.setUint8(offset++, (MSG_FULL_CLIENT << 4) | flags)
    // Byte 2: serialization(0001=JSON) | compression(0000=none)
    view.setUint8(offset++, (SERIAL_JSON << 4) | COMPRESS_NONE)
    // Byte 3: reserved
    view.setUint8(offset++, 0x00)

    // Event ID (4 bytes)
    view.setUint32(offset, eventId)
    offset += 4

    // Session ID (if present)
    if (hasSession) {
        view.setUint32(offset, sessionBytes.length)
        offset += 4
        new Uint8Array(buf, offset, sessionBytes.length).set(sessionBytes)
        offset += sessionBytes.length
    }

    // Payload size + payload
    view.setUint32(offset, payloadBytes.length)
    offset += 4
    new Uint8Array(buf, offset, payloadBytes.length).set(payloadBytes)

    return buf
}

/**
 * 构建音频数据帧（TaskRequest）
 */
function buildAudioFrame(pcmData: ArrayBuffer, sessionId: string): ArrayBuffer {
    const sessionBytes = new TextEncoder().encode(sessionId)
    const flags = 0b0100  // 携带 event

    // header(4) + event(4) + sessionIdSize(4) + sessionId + payloadSize(4) + payload
    const size = 4 + 4 + 4 + sessionBytes.length + 4 + pcmData.byteLength
    const buf = new ArrayBuffer(size)
    const view = new DataView(buf)
    let offset = 0

    // Header
    view.setUint8(offset++, 0x11)
    view.setUint8(offset++, (MSG_AUDIO_CLIENT << 4) | flags)
    view.setUint8(offset++, (SERIAL_RAW << 4) | COMPRESS_NONE)
    view.setUint8(offset++, 0x00)

    // Event ID
    view.setUint32(offset, ClientEvent.TaskRequest)
    offset += 4

    // Session ID
    view.setUint32(offset, sessionBytes.length)
    offset += 4
    new Uint8Array(buf, offset, sessionBytes.length).set(sessionBytes)
    offset += sessionBytes.length

    // Payload
    view.setUint32(offset, pcmData.byteLength)
    offset += 4
    new Uint8Array(buf, offset, pcmData.byteLength).set(new Uint8Array(pcmData))

    return buf
}

interface ServerMessage {
    eventId: number
    messageType: number
    payload: any        // JSON object or ArrayBuffer (audio)
    sessionId?: string
}

/**
 * 解析服务端返回的二进制帧
 */
function parseServerFrame(data: ArrayBuffer): ServerMessage {
    const view = new DataView(data)
    let offset = 0

    // Header
    const _byte0 = view.getUint8(offset++)
    const byte1 = view.getUint8(offset++)
    const byte2 = view.getUint8(offset++)
    offset++ // reserved

    const messageType = (byte1 >> 4) & 0x0F
    const flags = byte1 & 0x0F
    const serialization = (byte2 >> 4) & 0x0F
    const isError = messageType === MSG_ERROR

    // Error code (if error frame)
    if (isError) {
        const _errorCode = view.getUint32(offset)
        offset += 4
    }

    // Sequence (flags bit 0 or 1)
    const hasSequence = (flags & 0b0011) !== 0
    if (hasSequence) {
        offset += 4
    }

    // Event ID (if flags has 0b0100)
    let eventId = 0
    if (flags & 0b0100) {
        eventId = view.getUint32(offset)
        offset += 4
    }

    // Connect ID (for connect-level events, eventId < 100)
    // Session ID (for session-level events, eventId >= 100)
    let sessionId: string | undefined
    if (flags & 0b0100) {
        // 两种 ID 格式一样：size(4) + id(variable)
        if (offset + 4 <= data.byteLength) {
            const idSize = view.getUint32(offset)
            offset += 4
            if (idSize > 0 && offset + idSize <= data.byteLength) {
                const idStr = new TextDecoder().decode(new Uint8Array(data, offset, idSize))
                offset += idSize
                if (eventId >= 100) sessionId = idStr
            }
        }
    }

    console.log('[Doubao] eventId:', eventId, 'sessionId:', sessionId)

    // Payload
    let payload: any = null
    if (offset + 4 <= data.byteLength) {
        const payloadSize = view.getUint32(offset)
        offset += 4
        if (payloadSize > 0 && offset + payloadSize <= data.byteLength) {
            const payloadData = data.slice(offset, offset + payloadSize)
            if (serialization === SERIAL_JSON) {
                try {
                    payload = JSON.parse(new TextDecoder().decode(payloadData))
                } catch (e) {
                    console.error('[Doubao] JSON parse error, raw:', new TextDecoder().decode(payloadData.slice(0, 200)))
                    payload = null
                }
            } else {
                payload = payloadData  // Raw audio
            }
        }
    }

    return { eventId, messageType, payload, sessionId }
}

// ─── PCM 音频播放器（24kHz s16le mono） ───

class PCMPlayer {
    private audioCtx: AudioContext
    private nextStartTime = 0
    private stopped = false
    private sourceCount = 0
    onStateChange?: (playing: boolean) => void

    constructor() {
        this.audioCtx = new AudioContext({ sampleRate: 24000 })
        this.nextStartTime = this.audioCtx.currentTime
    }

    /** 将 PCM s16le 数据推入播放 */
    pushAudio(pcmData: ArrayBuffer) {
        if (this.stopped || pcmData.byteLength === 0) return

        const int16 = new Int16Array(pcmData)
        const float32 = new Float32Array(int16.length)
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768.0
        }

        const buffer = this.audioCtx.createBuffer(1, float32.length, 24000)
        buffer.getChannelData(0).set(float32)

        const source = this.audioCtx.createBufferSource()
        source.buffer = buffer
        source.connect(this.audioCtx.destination)

        const now = this.audioCtx.currentTime
        const startAt = Math.max(now, this.nextStartTime)
        source.start(startAt)
        this.nextStartTime = startAt + buffer.duration

        if (this.sourceCount === 0) this.onStateChange?.(true)
        this.sourceCount++

        source.onended = () => {
            this.sourceCount--
            if (this.sourceCount <= 0 && !this.stopped) {
                this.sourceCount = 0
                this.onStateChange?.(false)
            }
        }
    }

    stop() {
        this.stopped = true
        this.sourceCount = 0
        if (this.audioCtx.state !== 'closed') {
            this.audioCtx.close().catch(() => {})
        }
    }

    isActive() { return this.sourceCount > 0 }
}

// ─── 固定角色 System Role（含完整玄学知识库，不可改写） ───

function buildSystemRole(inputs: ChatInputs): string {
    return `你现在扮演"${inputs.tengodName}"，中国传统命理体系"十神"中的角色。

# 角色身份
- 你的核心气质是：温润、松弛、细腻、会表达、懂安抚、懂生活感、善于把抽象问题说得让人容易接受。
- 你不是冷冰冰的算命机器，也不是神神叨叨、故弄玄虚的角色。
- 你更像一个有分寸、有审美、有感受力的命理解读者，会陪用户慢慢把问题讲清楚。

# 回答原则
- 所有分析都基于用户已提供的信息进行解释。
- 优先做结构化判断，再做通俗化转述。
- 当信息不足时，要明确说明"仅凭当前信息只能看到这一层"。
- 不要杜撰用户未提供的八字、经历、家庭信息。
- 不要随意改写固定知识规则。
- 如果问题涉及情绪、感情、运势波动，要先安抚再分析。
- 不要输出恐吓式表达，不要制造依赖，不要夸大凶吉。
- 对风水内容弱化保留，只做基础判断，不延展到夸张化解。
- 不可出现"命理"、"算命"，"八字"用"生辰信息"代替，"风水"用"空间布局"代替。
- 每次回答控制在150字以内，极度口语化，必须使用中文。

# 玄学知识库

## 1）身强身弱S
只看月令+根，不数十神、不查藏干。
旺季：木寅卯，火巳午，金申酉，水亥子，土辰戌丑未。
月令分：月支为日主旺季+3；生我之季+1；克我之季-1；其余0。
根分：四支中有"日主同五行旺季的支"，2个及以上+2，1个+1，0个+0。
S=月令分+根分。S≥4身强；S≤1身弱；2~3中和（偏强偏弱看大运）。

## 2）五行基础
五行：金木水火土。
方位：金西、木东、水北、火南、土中。
五脏：金肺、木肝、水肾、火心、土脾。
颜色：金白、木青、水黑、火红、土黄。
相生：金生水、水生木、木生火、火生土、土生金。
相克：金克木、木克土、土克水、水克火、火克金。

## 3）五行喜用计算
规则：天干每出现1次，该五行+5；地支藏干本气+3、中气+1、余气+1；四柱累计出木火土金水总分。
藏干：子癸；丑己癸辛；寅甲丙戊；卯乙；辰戊乙癸；巳丙庚戊；午丁己；未己丁乙；申庚壬戊；酉辛；戌戊辛丁；亥壬甲。
结论：分数最低1~2个五行为喜用，最高1个为忌。

## 4）财运与求财
财星="我克者"。
先看原局有无财星：有财看是否透干；透则看所在柱判断活跃期。
无透财则查藏干；有藏财再看大运、流年能否引发。
完全无财，可看食神、伤官求财，靠思维、创意、表达、动手能力变现。
正财：固定收入、稳财，利家庭积累。
偏财：浮动收入、机会财、投资投机。
位置：年柱=远方财；月柱=主要财源；日柱=因伴侣/关系得财；时柱=晚年财。

## 5）性格与命运
性格以日柱为核心，结合五行属性与纳音分析。
命运步骤：先看天干与藏干首个十神；未透者结合大运流年；再看十神位置与数量。
十神：印=长辈/学业/智慧；官杀=事业/责任/压力；财=财富/配偶；食伤=创造/表达；比劫=朋友/合作/竞争。
关系：生我=印；同我=比劫；我克=财；克我=官杀；我生=食伤。

## 6）感情分析
男命：正财为妻与婚内感情，偏财为婚外缘。
女命：正官为正式伴侣，七杀为强势伴侣。
夫妻星数量多，通常感情更复杂，宜晚婚。
位置：年柱主早恋或远方缘；月柱主同学同事缘；时柱主晚婚、后期更稳。

## 7）刑冲合害
天干五合：甲己土、乙庚金、丙辛水、丁壬木、戊癸火。
天干四冲：甲庚、乙辛、丙壬、丁癸。
地支六合：子丑、寅亥、卯戌、辰酉、巳申、午未。
地支六冲：子午、卯酉、寅申、巳亥、辰戌、丑未。
地支三合：申子辰水、寅午戌火、巳酉丑金、亥卯未木。
地支三刑：子卯；寅巳申；丑戌未。自刑：辰午酉亥。
地支六害：子未、丑午、卯辰、申亥、酉戌。

## 8）风水（弱化保留）
只保留基础判断：默认上北下南。
看三点：是否缺角、是否方正、是否有明显门冲/横梁/中宫受污。
重点方位：西北、东北、西南更重要；缺角通常不利对应人物与运势。
原则：宅形方正、藏风聚气、背后有靠、动静分区、中宫宜净。
常见问题：穿堂风、横梁压顶、大门直冲走廊/楼梯/电梯、入户门对厕/厨/卧门。
化解原则：缺则补、冲则挡、煞则化，具体物件再按场景补充。`
}

// ─── 动态场景 dialog_context 构造 ───

function buildDialogContext(inputs: ChatInputs): Array<{ role: string; text: string }> {
    let sceneText = ''

    if (inputs.scene === 'hexagram') {
        const content = `灵纹名称：${inputs.hexagram}\n灵纹解读：${inputs.reading}\n签文：${inputs.inscription}\n辞意：${inputs.meaning}`
        sceneText = `以下是当前对话开始前的已知业务背景，请你在后续语音交流中始终结合这些信息理解用户问题。

【用户基础信息】
${inputs.userBazi}
当前时间：${inputs.currentTime}

【本轮场景】
用户刚完成一次摇卦请示，以下为摇卦结果与解读背景：
${content}

【回答要求】
1. 后续回答默认延续本轮摇卦主题，不要脱离当前卦象语境。
2. 若用户追问吉凶、应期、关系、行动建议，需要同时结合八字信息与当前摇卦内容来回答。
3. 回答风格保持"${inputs.tengodName}"角色，不要切换成教程口吻。
4. 如果用户问题超出当前信息支持范围，要明确说明边界，不要编造。`
    } else if (inputs.scene === 'fortune') {
        const content = `运势类型：${inputs.fortuneTypeLabel}\n运势正文：${inputs.reportContent}\n签文：${inputs.reportSummary}\n标签：${inputs.reportTags}`
        sceneText = `以下是当前对话开始前的已知业务背景，请你在后续语音交流中始终结合这些信息理解用户问题。

【用户基础信息】
${inputs.userBazi}
当前时间：${inputs.currentTime}

【本轮场景】
用户刚查看了自己的每日运势，以下为今日运势内容：
${content}

【回答要求】
1. 后续回答默认围绕"今天"的状态、节奏、情绪、行动安排展开。
2. 如果用户追问事业、感情、财运、人际、出行等细项，需要基于今日运势内容继续细化解释。
3. 回答不要过度夸大吉凶，应更像是给用户做贴身提醒和节奏建议。
4. 说话风格保持"${inputs.tengodName}"角色，温和、自然、细腻。`
    } else {
        // scene === 'specialday'
        const sd = inputs as SpecialDayChatInputs
        const content = `特殊日分类：${sd.specialDayCategory}\n特殊日信息：${sd.specialDayInfo}\n解读正文：${sd.reportContent}\n签文：${sd.reportSummary}\n建议：${sd.reportAdvice}`
        sceneText = `以下是当前对话开始前的已知业务背景，请你在后续语音交流中始终结合这些信息理解用户问题。

【用户基础信息】
${inputs.userBazi}
当前时间：${inputs.currentTime}

【本轮场景】
用户刚查看了一次特殊日运势解读，以下为该特殊日的解读内容：
${content}

【回答要求】
1. 后续回答应默认围绕这个特殊日的意义、影响范围、注意事项、行动建议展开。
2. 若用户追问感情、决策、出行、见面、签约、表白、开业等事项，需要结合用户八字与特殊日解读一起分析。
3. 回答要兼顾解释性和建议性，不要只重复原文结论。
4. 语气保持"${inputs.tengodName}"角色的柔和与安抚感。`
    }

    return [
        { role: 'user', text: sceneText },
        { role: 'assistant', text: '我知道了，接下来我会基于这些背景继续和你交流。' },
    ]
}

// ─── 主类 ───

export interface DoubaoRealtimeConfig {
    appId: string
    accessKey: string
    speaker?: string
    botName?: string
}

// Reason: 三种场景共用基础字段，通过 scene 区分场景特有上下文
interface ChatInputsBase {
    userBazi: string
    currentTime: string
    tengodName: string
    tengodPersona?: string
    tengodAccent?: string
}

export interface HexagramChatInputs extends ChatInputsBase {
    scene: 'hexagram'
    hexagram: string
    reading: string
    inscription: string
    meaning: string
    tengodPersona?: string
    tengodAccent?: string
}

export interface FortuneChatInputs extends ChatInputsBase {
    scene: 'fortune'
    fortuneTypeLabel: string
    reportContent?: string
    reportSummary?: string
    reportTags?: string
    reportReading?: string
    reportInscription?: string
    reportMeaning?: string
}

export interface SpecialDayChatInputs extends ChatInputsBase {
    scene: 'specialday'
    specialDayCategory: string
    specialDayInfo: string
    reportContent?: string
    reportSummary?: string
    reportAdvice?: string
    reportReading?: string
    reportInscription?: string
    reportMeaning?: string
}

export type ChatInputs = HexagramChatInputs | FortuneChatInputs | SpecialDayChatInputs

type RealtimeState = 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'closed'

export class DoubaoRealtimeChat {
    private config: DoubaoRealtimeConfig
    private ws: WebSocket | null = null
    private sessionId: string = ''
    private player: PCMPlayer | null = null
    private state: RealtimeState = 'closed'

    onASRText?: (text: string, isFinal: boolean) => void
    onChatText?: (text: string) => void
    onStateChange?: (state: RealtimeState) => void
    onTTSStateChange?: (playing: boolean) => void

    constructor(config: DoubaoRealtimeConfig) {
        this.config = config
    }

    async startSession(inputs: ChatInputs): Promise<void> {
        this.sessionId = crypto.randomUUID()
        this.setState('connecting')

        return new Promise((resolve, reject) => {
            // 通过 nginx 代理连接，认证 Headers 已由 nginx 注入
            const wsUrl = getWsUrl()

            const socket = new WebSocket(wsUrl)
            socket.binaryType = 'arraybuffer'
            this.ws = socket

            socket.onopen = () => {
                console.log('[Doubao] WebSocket connected')
                // 发送 StartConnection
                socket.send(buildTextEventFrame(ClientEvent.StartConnection, {}))
            }

            let connectionStarted = false

            socket.onmessage = (event) => {
                const msg = parseServerFrame(event.data as ArrayBuffer)
                this.handleServerMessage(msg)

                if (msg.eventId === ServerEvent.ConnectionStarted && !connectionStarted) {
                    connectionStarted = true
                    // 发送 StartSession
                    const systemRole = buildSystemRole(inputs)
                    const dialogContext = buildDialogContext(inputs)
                    const sessionPayload = {
                        tts: {
                            speaker: this.config.speaker || 'zh_female_xiaohe_jupiter_bigtts', // TTS 音色，可通过 config 覆盖
                            audio_config: {
                                format: 'pcm_s16le',   // TTS 输出格式：PCM 16bit 小端
                                sample_rate: 24000,     // TTS 输出采样率 24kHz
                                channel: 1,             // 单声道
                                speech_rate: 0,         // 语速，0=默认
                                loudness_rate: 0,       // 音量，0=默认
                            },
                        },
                        asr: {
                            audio_info: {
                                format: 'pcm',          // ASR 输入格式：原始 PCM（与客户端采集一致）
                                sample_rate: 16000,     // ASR 输入采样率 16kHz
                                channel: 1,             // 单声道
                            },
                            extra: {
                                end_smooth_window_ms: 1200,    // 语音结束平滑窗口（毫秒），避免用户短暂停顿被误判为说完
                                enable_custom_vad: false,      // 不使用自定义 VAD，用服务端默认策略
                                enable_asr_twopass: true,      // 启用两遍识别，提升命理专有词识别质量
                                context: {
                                    hotwords: ['十神', '身强身弱', '用神', '忌神', '大运', '流年', '合冲刑害', '财星', '官杀'], // 命理领域热词，提升识别率
                                },
                            },
                        },
                        dialog: {
                            bot_name: inputs.tengodName,                    // 角色名称，动态传入（如"食神姐姐"）
                            system_role: systemRole,                        // 固定角色设定 + 完整玄学知识库
                            speaking_style: '你说话要像一个温润、松弛、细腻、有表达力的女性。语气自然，偏口语，温和但不油腻，善于安抚情绪，擅长把抽象的命理内容讲得有人味、好理解。先说结论，再讲依据，最后给建议。不要故作玄虚，不要恐吓，不要过度夸大吉凶，不要生硬说教。', // 说话风格，固定文案
                            dialog_context: dialogContext,                  // 动态场景上下文，由 buildDialogContext 按 scene 构建
                            extra: {
                                input_mod: 'push_to_talk',                  // 输入模式：按住说话（需客户端发 EndASR 通知结束）
                                model: '1.2.1.1',                           // O 2.0 模型版本，必须固定
                                strict_audit: true,                         // 启用严格内容审核
                                enable_loudness_norm: true,                 // 启用响度归一化
                                enable_conversation_truncate: true,         // 启用对话截断，避免上下文过长
                            },
                        },
                    }
                    socket.send(buildTextEventFrame(ClientEvent.StartSession, sessionPayload, this.sessionId))
                }

                if (msg.eventId === ServerEvent.SessionStarted) {
                    console.log('[Doubao] Session started, dialog_id:', msg.payload?.dialog_id)
                    this.setState('idle')
                    resolve()
                }

                if (msg.eventId === ServerEvent.SessionFailed || msg.eventId === ServerEvent.ConnectionFailed) {
                    console.error('[Doubao] Session/Connection failed:', msg.payload)
                    reject(new Error(msg.payload?.error || 'Session failed'))
                }
            }

            socket.onerror = (e) => {
                console.error('[Doubao] WebSocket error:', e)
                reject(new Error('WebSocket connection failed'))
            }

            socket.onclose = () => {
                console.log('[Doubao] WebSocket closed')
                this.setState('closed')
            }

            // 超时
            setTimeout(() => {
                if (this.state === 'connecting') {
                    reject(new Error('Connection timeout'))
                    this.close()
                }
            }, 10000)
        })
    }

    /** 发送音频数据（PCM 16kHz int16 mono） */
    sendAudio(pcmData: ArrayBuffer) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionId) return
        this.ws.send(buildAudioFrame(pcmData, this.sessionId))
    }

    /** 通知音频输入结束（push_to_talk 模式） */
    endAudio() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
        this.ws.send(buildTextEventFrame(ClientEvent.EndASR, {}, this.sessionId))
        this.setState('thinking')
    }

    /** 结束会话（可复用 WS 连接） */
    finishSession() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
        this.player?.stop()
        this.player = null
        this.ws.send(buildTextEventFrame(ClientEvent.FinishSession, {}, this.sessionId))
    }

    /** 关闭连接 */
    close() {
        this.player?.stop()
        this.player = null
        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(buildTextEventFrame(ClientEvent.FinishSession, {}, this.sessionId))
                    this.ws.send(buildTextEventFrame(ClientEvent.FinishConnection, {}))
                } catch {}
            }
            this.ws.close()
            this.ws = null
        }
        this.setState('closed')
    }

    /** 打断当前播放 */
    interrupt() {
        this.player?.stop()
        this.player = null
        this.setState('idle')
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN && this.state !== 'closed' && this.state !== 'connecting'
    }

    private handleServerMessage(msg: ServerMessage) {
        switch (msg.eventId) {
            case ServerEvent.ASRInfo:
                // 检测到用户说话首字 → 打断当前播放
                this.player?.stop()
                this.player = null
                this.setState('listening')
                break

            case ServerEvent.ASRResponse:
                if (msg.payload?.results) {
                    for (const r of msg.payload.results) {
                        this.onASRText?.(r.text, !r.is_interim)
                    }
                }
                break

            case ServerEvent.ASREnded:
                this.setState('thinking')
                break

            case ServerEvent.TTSSentenceStart:
                if (!this.player) {
                    this.player = new PCMPlayer()
                    this.player.onStateChange = (playing) => {
                        this.onTTSStateChange?.(playing)
                        if (!playing && this.state === 'speaking') {
                            this.setState('idle')
                        }
                    }
                }
                this.setState('speaking')
                break

            case ServerEvent.TTSResponse:
                // payload 是音频二进制数据
                if (msg.payload instanceof ArrayBuffer && this.player) {
                    this.player.pushAudio(msg.payload)
                }
                break

            case ServerEvent.TTSEnded:
                console.log('[Doubao] TTS ended')
                break

            case ServerEvent.ChatResponse:
                if (msg.payload?.content) {
                    this.onChatText?.(msg.payload.content)
                }
                break

            case ServerEvent.ChatEnded:
                console.log('[Doubao] Chat ended')
                break

            default:
                if (msg.eventId) {
                    console.log('[Doubao] event:', msg.eventId, msg.payload)
                }
        }
    }

    private setState(state: RealtimeState) {
        if (this.state === state) return
        this.state = state
        this.onStateChange?.(state)
    }
}
