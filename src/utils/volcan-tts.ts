/**
 * 火山引擎 TTS 客户端 (浏览器端)
 * 开发环境通过 Vite proxy (/volcan-tts) 转发
 * 生产环境需要自行配置 nginx 代理
 */

import { getAppConfig } from './api'

const API_URL = '/volcan-tts'

let idCounter = 0
function nextReqId(): string {
    return `pi-tts-${Date.now()}-${++idCounter}`
}

/**
 * 调用火山引擎 TTS，返回 base64 编码的音频数据
 */
async function synthesize(text: string, voiceType: string, options?: {
    encoding?: 'mp3' | 'wav' | 'pcm' | 'ogg_opus'
    speedRatio?: number
    emotion?: string
}): Promise<string> {
    const encoding = options?.encoding ?? 'mp3'

    const audioConfig: Record<string, unknown> = {
        voice_type: voiceType,
        encoding,
        rate: 24000,
        speed_ratio: options?.speedRatio ?? 1.0,
    }

    if (options?.emotion) {
        audioConfig.emotion = options.emotion
        audioConfig.enable_emotion = true
    }

    // Reason: APPID / ACCESS_TOKEN 已移入 config.json (DOUBAO 节点)，避免硬编码密钥
    const config = await getAppConfig()
    const appId = config.DOUBAO?.APP_ID ?? ''
    const accessToken = config.DOUBAO?.ACCESS_KEY ?? ''

    const body = {
        app: {
            appid: appId,
            token: 'access_token',
            cluster: 'volcano_tts',
        },
        user: {
            uid: 'pi-user',
        },
        audio: audioConfig,
        request: {
            reqid: nextReqId(),
            text,
            operation: 'query',
        },
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer;${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
    })

    const data = await response.json()
    if (data.code === 3000 && data.data) {
        return data.data
    }
    throw new Error(`TTS 失败: ${data.message || '未知错误'} (code: ${data.code})`)
}

// ========== 句子分割 ==========

const SENTENCE_SPLITTER = /(?<=[。！？\n])/

// ========== 流水线 TTS 播放器 ==========

/**
 * 流水线 TTS 播放器
 *
 * 双循环流水线架构：
 *   合成循环(synthesizeLoop)：文本队列 → 并发合成(最多 PREFETCH 个) → 音频队列
 *   播放循环(playLoop)：音频队列 → 依次播放
 *
 * 合成和播放并行，播放第 1 句时第 2、3 句已经在合成，
 * 大幅减少等待时间。
 */
export class TTSPlayer {
    private voiceType: string
    private textQueue: string[] = []         // 待合成的句子
    private audioQueue: AudioItem[] = []     // 已合成待播放的音频
    private buffer = ''                      // 未拆完的文本碎片
    private stopped = false
    private flushed = false                  // flush() 已调用
    private synthesizing = false             // 合成循环是否在运行
    private playing = false                  // 播放循环是否在运行
    private currentAudio: HTMLAudioElement | null = null
    private onStateChange?: (playing: boolean) => void
    private speedRatio: number

    // 预合成并发数：同时发起几个 HTTP 合成请求
    private static PREFETCH = 3

    constructor(voiceType: string, onStateChange?: (playing: boolean) => void, speedRatio = 1.0) {
        this.voiceType = voiceType
        this.onStateChange = onStateChange
        this.speedRatio = speedRatio
    }

    /** 流式追加文本 */
    feed(chunk: string) {
        if (this.stopped) return
        this.buffer += chunk
        const parts = this.buffer.split(SENTENCE_SPLITTER)
        this.buffer = parts.pop() ?? ''
        for (const s of parts) {
            const trimmed = s.trim()
            if (trimmed) {
                this.textQueue.push(trimmed)
            }
        }
        this.kickSynthesize()
    }

    /** 文本全部输入完毕 */
    flush() {
        if (this.buffer.trim()) {
            this.textQueue.push(this.buffer.trim())
            this.buffer = ''
        }
        this.flushed = true
        this.kickSynthesize()
    }

    /** 停止 */
    stop() {
        this.stopped = true
        this.textQueue = []
        this.audioQueue = []
        this.buffer = ''
        if (this.currentAudio) {
            this.currentAudio.pause()
            this.currentAudio.src = ''
            this.currentAudio = null
        }
        this.synthesizing = false
        this.playing = false
        this.onStateChange?.(false)
    }

    isPlaying(): boolean {
        return this.playing || this.synthesizing
    }

    // ---- 合成循环 ----

    private kickSynthesize() {
        if (this.synthesizing || this.stopped) return
        this.synthesizeLoop()
    }

    private async synthesizeLoop() {
        if (this.synthesizing) return
        this.synthesizing = true

        while (!this.stopped) {
            // 取一批（最多 PREFETCH 个）句子并发合成
            const batch = this.textQueue.splice(0, TTSPlayer.PREFETCH)
            if (batch.length === 0) break

            // 并发请求，但用 slot 数组保持顺序
            const PENDING = Symbol()
            const slots: (AudioItem | null | typeof PENDING)[] = batch.map(() => PENDING)
            let nextToFlush = 0  // 下一个该推入播放的位置

            const pending = batch.map(async (sentence, idx): Promise<void> => {
                try {
                    const base64 = await synthesize(sentence, this.voiceType, { encoding: 'mp3', speedRatio: this.speedRatio })
                    if (this.stopped) return
                    slots[idx] = { base64, text: sentence }
                } catch (e) {
                    console.error('TTS 合成失败:', sentence.slice(0, 20), e)
                    slots[idx] = null  // 完成但失败
                }
                // 按顺序刷入：从 nextToFlush 开始，连续已完成的 slot 推入播放队列
                while (nextToFlush < slots.length && slots[nextToFlush] !== PENDING) {
                    const item = slots[nextToFlush] as AudioItem | null
                    if (item && !this.stopped) {
                        this.audioQueue.push(item)
                        this.kickPlay()
                    }
                    nextToFlush++
                }
            })

            await Promise.all(pending)
            if (this.stopped) break
        }

        this.synthesizing = false

        // 合成完了但文本队列又有新的（流还在输出），再跑一轮
        if (!this.stopped && this.textQueue.length > 0) {
            this.synthesizeLoop()
        }
    }

    // ---- 播放循环 ----

    private kickPlay() {
        if (this.playing || this.stopped) return
        this.playLoop()
    }

    private async playLoop() {
        if (this.playing) return
        this.playing = true
        this.onStateChange?.(true)

        while (!this.stopped) {
            const item = this.audioQueue.shift()
            if (!item) {
                // 音频队列空：如果合成还在跑或文本还没 flush，等一下再看
                if (this.synthesizing || !this.flushed || this.textQueue.length > 0) {
                    await sleep(100)
                    continue
                }
                // 真的没了
                break
            }
            try {
                await this.playBase64(item.base64)
            } catch (e) {
                console.error('TTS 播放失败:', e)
            }
        }

        this.playing = false
        if (!this.stopped) {
            this.onStateChange?.(false)
            // 可能又有新音频了
            if (this.audioQueue.length > 0) {
                this.playLoop()
            }
        }
    }

    private playBase64(base64: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const audio = new Audio(`data:audio/mp3;base64,${base64}`)
            this.currentAudio = audio
            audio.addEventListener('ended', () => {
                this.currentAudio = null
                resolve()
            })
            audio.addEventListener('error', (e) => {
                this.currentAudio = null
                reject(e)
            })
            audio.play().catch(reject)
        })
    }
}

type AudioItem = {
    base64: string
    text: string
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}

const volcanTTS = {
    synthesize,
    TTSPlayer,
}

export default volcanTTS
