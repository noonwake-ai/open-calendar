import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { paths } from '../router/urls'
import { colors, fontSize, fontWeight, radius, spacing, withAlpha } from '../styles/tokens'
import { SolarDay } from 'tyme4ts'
import { DailyFortuneType, DailyFortuneType2Label, DailyFortuneType2Question } from '../domain/fortune'
import { sendProjectionMessage } from '../utils/projection-channel'
import { saveFortuneViewedTags } from '../utils/fortune-viewed-store'
import { getBaziInfoStr, getCurrentTimeWuxing } from '../utils/bazi-store'
import { TTSPlayer } from '../utils/volcan-tts'
import { cleanLLMResponse } from '../common/utils'
import { getReportCache, saveReportCache } from '../utils/local-db'
import { getUserId } from '../utils/user-store'
import { DoubaoRealtimeChat, type FortuneChatInputs } from '../utils/doubao-realtime'
import dify from '../utils/dify'
import { getAppConfig } from '../utils/api'
import BackButton from '../components/back-button'
import PrintSignCard from '../components/print-sign-card'
import printer from '../utils/printer'

const FORTUNE_TYPE_COLORS: Record<string, string> = {
    love: colors.fortune.love,
    career: colors.fortune.career,
    wealth: colors.fortune.wealth,
    study: colors.fortune.study,
}

const TTS_VOICE_TYPE = 'zh_female_xiaohe_uranus_bigtts'
const TENGOD_NAME = '食神'
const TENGOD_PERSONA = ''
const TENGOD_ACCENT = ''

// Mock fallback — Dify 不可用时展示
const MOCK_DATA: Record<string, FortuneReportData> = {
    love: {
        reading: '今日感情运势极佳。单身者有机会在社交场合遇到令人心动的对象，不妨主动展示自己的魅力。已有伴侣者，今天适合与另一半进行深入的交流，分享内心的想法和感受，能够增进彼此的理解和信任。注意保持真诚的态度，避免过于急躁或强势，让感情自然流动。',
        inscription: ['桃花朵朵', '情缘如意'], meaning: '真心相遇，情缘自然来',
        fortune_index: 4, tags: ['桃花旺盛', '真心相遇', '情感升温'],
    },
    career: {
        reading: '事业方面今日有贵人指引，适合推进重要项目或提出新的方案。你的创意和执行力将得到认可，领导和同事会对你的工作表现给予积极的反馈。把握住上午的黄金时段处理关键事务，下午则适合与团队协作沟通。避免与人争执，以和为贵方能事半功倍。',
        inscription: ['步步高升', '前程似锦'], meaning: '贵人助力，稳中求进',
        fortune_index: 4, tags: ['贵人相助', '稳中求进', '机遇涌现'],
    },
    wealth: {
        reading: '今日财运极佳，正财偏财皆有收获的可能。工作中可能会有额外的奖金或提成，也适合进行理性的投资决策。但切记不要贪心冒进，稳健的理财策略才是长久之道。日常消费注意节制，避免冲动购物。下午时分可能有意外之财的惊喜。',
        inscription: ['财源滚滚', '金玉满堂'], meaning: '稳健理财，意外之喜',
        fortune_index: 5, tags: ['财源广进', '偏财旺盛', '投资有利'],
    },
    study: {
        reading: '今日学业运势走高，思路清晰，适合深度学习和研究复杂问题。记忆力和理解力都处于较好状态，是攻克难题的好时机。建议上午专注于核心课程或重点知识的复习，下午可以拓展阅读或练习实践技能。保持专注，减少外界干扰，你会发现学习效率显著提升。',
        inscription: ['金榜题名', '学业有成'], meaning: '思路清晰，攻克难题',
        fortune_index: 4, tags: ['思维敏捷', '灵感爆发', '学有所成'],
    },
}

interface FortuneReportData {
    reading: string
    inscription: [string, string]
    meaning: string
    fortune_index: number
    tags: [string, string, string]
}

function getGanzhiDate(): string {
    try {
        const now = new Date()
        const solar = SolarDay.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate())
        const lunar = solar.getLunarDay()
        return `${lunar.getYearSixtyCycle().getName()}年${lunar.getMonthSixtyCycle().getName()}月${lunar.getSixtyCycle().getName()}日`
    } catch {
        return '甲辰年丙寅月壬午日'
    }
}

export default function FortuneTypeDetail(): ReactElement {
    const { fortuneType } = useParams<{ fortuneType: string }>()
    const location = useLocation()
    const state = location.state as { ganzhi?: string; lunar?: string } | null

    const type = fortuneType as DailyFortuneType
    const accentColor = FORTUNE_TYPE_COLORS[type] ?? colors.brand.light
    const label = DailyFortuneType2Label[type] ?? '运势详情'
    const mock = MOCK_DATA[type] ?? MOCK_DATA.love
    const ganzhiDate = state?.ganzhi || getGanzhiDate()

    const [loading, setLoading] = useState(true)
    const [reportData, setReportData] = useState<FortuneReportData | null>(null)
    const [doubaoReady, setDoubaoReady] = useState(false)
    const ttsPlayerRef = useRef<TTSPlayer | null>(null)
    const doubaoRef = useRef<DoubaoRealtimeChat | null>(null)

    // Reason: 页面卸载时完整清理（TTS + 豆包连接 + 副屏复位）
    useEffect(() => {
        return () => {
            ttsPlayerRef.current?.stop()
            doubaoRef.current?.close()
            sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
        }
    }, [])

    const interrupt = useCallback(() => {
        ttsPlayerRef.current?.stop()
        doubaoRef.current?.interrupt()
        sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
    }, [])

    // Reason: 加载或生成运势报告（当日缓存 → Dify blocking → fallback Mock）
    useEffect(() => {
        let cancelled = false
        async function loadOrFetch() {
            const config = await getAppConfig()
            const cached = await getReportCache<FortuneReportData>('fortune', type)
            if (cached && !cancelled) {
                setReportData(cached)
                setLoading(false)
                saveFortuneViewedTags(type, cached.tags)
                return
            }
            try {
                const result = await dify.completionMessages(
                    { apiKey: config.DIFY?.FORTUNE_REPORT_KEY ?? '', baseUrl: config.DIFY?.BASE_URL ?? '' }, {
                    inputs: {
                        fortune_type_label: DailyFortuneType2Label[type] ?? '运势',
                        question: DailyFortuneType2Question[type] ?? '今日运势如何？',
                        current_time: getCurrentTimeWuxing(),
                        user_bazi_info: getBaziInfoStr(),
                        tengod_name: TENGOD_NAME,
                        tengod_persona: TENGOD_PERSONA,
                        tengod_accent: TENGOD_ACCENT,
                    },
                    user: getUserId(),
                    files: [],
                    response_mode: 'blocking',
                })
                if (cancelled) return
                const jsonStr = cleanLLMResponse((result.answer ?? '').trim())
                if (!jsonStr) throw new Error('Dify 返回为空')
                const data = JSON.parse(jsonStr) as FortuneReportData
                setReportData(data)
                await saveReportCache('fortune', type, data)
                saveFortuneViewedTags(type, data.tags)
                // TTS 播报
                const ttsPlayer = new TTSPlayer(TTS_VOICE_TYPE, (playing) => {
                    sendProjectionMessage({ type: 'trigger_scene', scene: playing ? 'interpret' : 'idle' })
                })
                ttsPlayerRef.current = ttsPlayer
                ttsPlayer.feed(data.reading)
                ttsPlayer.flush()
            } catch (e) {
                console.error('运势报告生成失败，使用 Mock:', e)
                // Reason: Dify 不可用时 fallback 到 Mock
                if (!cancelled) {
                    sendProjectionMessage({ type: 'trigger_scene', scene: 'interpret', tts_content: mock.reading })
                    saveFortuneViewedTags(type, mock.tags)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadOrFetch()
        return () => { cancelled = true }
    }, [type])

    // Reason: 报告生成完成后初始化豆包端到端语音会话（同 shake-hexagram 模式）
    useEffect(() => {
        if (loading || !reportData) return

        // Reason: config 已在报告加载时缓存到 window.APP_CONFIG，此处同步读取
        const config = (window as any).APP_CONFIG ?? {}
        const doubao = new DoubaoRealtimeChat({
            appId: config.DOUBAO?.APP_ID ?? '',
            accessKey: config.DOUBAO?.ACCESS_KEY ?? '',
            speaker: config.DOUBAO?.SPEAKER,
            botName: '食神',
        })
        doubao.onStateChange = (state) => {
            if (state === 'speaking') {
                sendProjectionMessage({ type: 'trigger_scene', scene: 'interpret' })
            } else if (state === 'idle' || state === 'closed') {
                sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
            }
        }
        doubao.onTTSStateChange = (playing) => {
            if (playing) {
                sendProjectionMessage({ type: 'trigger_scene', scene: 'interpret' })
            } else {
                sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
            }
        }

        const inputs: FortuneChatInputs = {
            scene: 'fortune',
            fortuneTypeLabel: DailyFortuneType2Label[type] ?? '运势',
            reportReading: reportData.reading,
            reportInscription: reportData.inscription.join(''),
            reportMeaning: reportData.meaning,
            reportTags: reportData.tags.join('、'),
            userBazi: getBaziInfoStr(),
            currentTime: getCurrentTimeWuxing(),
            tengodName: TENGOD_NAME,
            tengodPersona: TENGOD_PERSONA,
            tengodAccent: TENGOD_ACCENT,
        }

        doubao.startSession(inputs)
            .then(() => {
                doubaoRef.current = doubao
                setDoubaoReady(true)
            })
            .catch((e) => {
                console.error('[Fortune Doubao] Session init failed:', e)
            })

        return () => {
            doubao.close()
            if (doubaoRef.current === doubao) doubaoRef.current = null
            setDoubaoReady(false)
        }
    }, [loading, reportData, type])

    // 豆包端到端音频回调
    const handleDoubaoAudio = useCallback((pcm: ArrayBuffer) => {
        doubaoRef.current?.sendAudio(pcm)
    }, [])

    const handleDoubaoRecordStop = useCallback(() => {
        doubaoRef.current?.endAudio()
    }, [])

    // 展示数据：优先 Dify 报告，fallback Mock
    const display = reportData ?? mock
    const [line1, line2] = display.inscription

    return (
        <div style={pageStyle}>
            <BackButton to={paths.home.index} />

            {/* ── 左侧：文字内容 ── */}
            <div style={leftPanelStyle}>
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <h1 style={{ ...titleStyle, color: accentColor }}>{label}</h1>
                    <p style={{ ...ganzhiStyle, color: withAlpha(accentColor, 0.4) }}>{ganzhiDate}</p>

                    {loading ? (
                        <p style={{ color: colors.text.muted, fontSize: fontSize.md }}>正在生成运势报告...</p>
                    ) : (
                        <>
                            <div style={tagsRowStyle}>
                                {display.tags.map((tag, i) => (
                                    <span key={i} style={{ ...tagStyle, borderColor: `${accentColor}44`, color: accentColor }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <div style={fortuneIndexStyle}>
                                {'★'.repeat(display.fortune_index)}{'☆'.repeat(5 - display.fortune_index)}
                            </div>

                            <p style={meaningStyle}>{display.meaning}</p>

                            <p style={contentStyle}>{display.reading}</p>
                        </>
                    )}
                </div>

                {/* 语音追问区域 */}
                {!loading && reportData && doubaoReady && (
                    <VoiceBar
                        onRecordStart={interrupt}
                        onAudioData={handleDoubaoAudio}
                        onRecordStop={handleDoubaoRecordStop}
                    />
                )}
            </div>

            {/* ── 右侧：运签卡片 ── */}
            <div style={rightPanelStyle}>
                {!loading && (
                    <PrintSignCard
                        topText={ganzhiDate}
                        line1={line1}
                        line2={line2}
                        bottomText={label}
                        accentColor={accentColor}
                        buttonLabel="打印运签"
                        onPrint={() => printer.print(line1, line2)}
                    />
                )}
            </div>
        </div>
    )
}

/* ─── Voice Bar (空格录音追问) ─── */

// Reason: 豆包模式 VoiceBar — 空格按下录音发送 PCM，松开结束
function VoiceBar({ onRecordStart, onAudioData, onRecordStop }: {
    onRecordStart?: () => void
    onAudioData?: (pcm: ArrayBuffer) => void
    onRecordStop?: () => void
}) {
    const [recording, setRecording] = useState(false)
    const streamRef = useRef<MediaStream | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const ctxRef = useRef<AudioContext | null>(null)

    useEffect(() => {
        const onKeyDown = async (e: KeyboardEvent) => {
            if (e.code !== 'Space' || e.repeat || recording) return
            e.preventDefault()
            onRecordStart?.()
            setRecording(true)

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
                streamRef.current = stream
                const audioCtx = new AudioContext({ sampleRate: 16000 })
                ctxRef.current = audioCtx
                const source = audioCtx.createMediaStreamSource(stream)
                const processor = audioCtx.createScriptProcessor(4096, 1, 1)
                processorRef.current = processor
                processor.onaudioprocess = (ev) => {
                    const float32 = ev.inputBuffer.getChannelData(0)
                    const int16 = new Int16Array(float32.length)
                    for (let i = 0; i < float32.length; i++) {
                        int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)))
                    }
                    onAudioData?.(int16.buffer)
                }
                source.connect(processor)
                processor.connect(audioCtx.destination)
            } catch (err) {
                console.error('麦克风获取失败:', err)
                setRecording(false)
            }
        }

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return
            e.preventDefault()
            setRecording(false)
            processorRef.current?.disconnect()
            streamRef.current?.getTracks().forEach(t => t.stop())
            ctxRef.current?.close().catch(() => {})
            processorRef.current = null
            streamRef.current = null
            ctxRef.current = null
            onRecordStop?.()
        }

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            processorRef.current?.disconnect()
            streamRef.current?.getTracks().forEach(t => t.stop())
            ctxRef.current?.close().catch(() => {})
        }
    }, [recording, onRecordStart, onAudioData, onRecordStop])

    return (
        <div style={voiceBarStyle}>
            <span style={voiceLabelStyle}>{recording ? '正在录音...' : '按住空格 语音追问'}</span>
        </div>
    )
}

/* ─── Styles ─── */

const pageStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'row', height: '100vh',
    padding: `${spacing.xl}px 80px`, gap: `${spacing.xl}px`,
    overflow: 'hidden', position: 'relative',
}
const leftPanelStyle: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', gap: `${spacing.md}px`, minWidth: 0,
}
const rightPanelStyle: React.CSSProperties = {
    width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: `${spacing.lg}px`,
}
const titleStyle: React.CSSProperties = {
    fontSize: fontSize.xxl, fontWeight: fontWeight.semibold, margin: 0, letterSpacing: '2px',
}
const ganzhiStyle: React.CSSProperties = {
    fontSize: fontSize.base, color: colors.text.muted,
    margin: `${spacing.xs}px 0 ${spacing.md}px`, letterSpacing: '1px',
}
const tagsRowStyle: React.CSSProperties = {
    display: 'flex', gap: `${spacing.xs}px`, marginBottom: `${spacing.lg}px`, flexWrap: 'wrap',
}
const tagStyle: React.CSSProperties = {
    padding: `4px ${spacing.sm}px`, border: '1px solid',
    borderRadius: radius.full, fontSize: fontSize.sm, letterSpacing: '0.5px',
}
const meaningStyle: React.CSSProperties = {
    fontSize: fontSize.base, color: colors.text.muted, fontStyle: 'italic',
    margin: `0 0 ${spacing.md}px`, letterSpacing: '0.5px',
}
const fortuneIndexStyle: React.CSSProperties = {
    fontSize: fontSize.xl, color: colors.brand.light, letterSpacing: '4px', marginBottom: `${spacing.md}px`,
}
const contentStyle: React.CSSProperties = {
    fontSize: fontSize.md, color: colors.text.primary, lineHeight: 1.8, margin: 0,
}
const voiceBarStyle: React.CSSProperties = {
    padding: `${spacing.sm}px`, background: 'rgba(116,65,255,0.06)',
    border: `1px solid ${colors.brand.border}`, borderRadius: radius.lg, textAlign: 'center',
}
const voiceLabelStyle: React.CSSProperties = {
    fontSize: fontSize.xs, color: colors.text.muted, letterSpacing: '1px',
}
