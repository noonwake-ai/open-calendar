// Reason: Web Speech API 类型在标准 DOM lib 中不完整，需要手动声明
declare class SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    maxAlternatives: number
    lang: string
    start(): void
    stop(): void
    abort(): void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    onstart: (() => void) | null
    onaudiostart: (() => void) | null
    onspeechstart: (() => void) | null
    onspeechend: (() => void) | null
    onaudioend: (() => void) | null
}
declare const webkitSpeechRecognition: typeof SpeechRecognition
interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList }
interface SpeechRecognitionErrorEvent extends Event { error: string; message: string }

/**
 * 语音识别统一接口
 * - Chrome 环境：使用浏览器原生 webkitSpeechRecognition
 * - 树莓派环境：通过 WebSocket 连接本地 Sherpa-onnx ASR 服务
 * 根据 config.json 的 ASR_WS_URL 自动切换
 */

import { getAppConfig } from './api'

export interface SpeechRecognitionResult {
    text: string
    isFinal: boolean
}

type SpeechRecognizerOptions = {
    onResult: (result: SpeechRecognitionResult) => void
    onReady: () => void
    onEnd: () => void
    onError: (error: string) => void
    lang?: string
    /** 外部传入的 MediaStream，WebSocket 模式复用同一个麦克风流 */
    mediaStream?: MediaStream
}

type SpeechRecognizerHandle = {
    start: () => void
    stop: () => void
    abort: () => void
    isListening: () => boolean
}

declare global {
    interface Window {
        webkitSpeechRecognition: new () => SpeechRecognition
    }
}

let cachedAsrWsUrl: string | null | undefined = undefined

export async function getAsrWsUrl(): Promise<string | null> {
    if (cachedAsrWsUrl !== undefined) return cachedAsrWsUrl
    try {
        const config = await getAppConfig()
        cachedAsrWsUrl = config.ASR_WS_URL || null
    } catch {
        cachedAsrWsUrl = null
    }
    return cachedAsrWsUrl
}

export function isSpeechRecognitionSupported(): boolean {
    // 同步检查原生支持；WebSocket 模式需要异步判断
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

export async function isAsrAvailable(): Promise<boolean> {
    const wsUrl = await getAsrWsUrl()
    if (wsUrl) return true
    return isSpeechRecognitionSupported()
}

// ─── Chrome 原生 Web Speech API 实现 ───

function createNativeRecognizer(options: SpeechRecognizerOptions): SpeechRecognizerHandle {
    const { onResult, onReady, onEnd, onError, lang = 'zh-CN' } = options

    const SpeechRecognitionCtor = window.webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRecognitionCtor) {
        return {
            start: () => onError('浏览器不支持语音识别'),
            stop: () => {},
            abort: () => {},
            isListening: () => false,
        }
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let listening = false
    let startTime = 0
    let shouldRestart = false
    let userStopped = false

    const MIN_PREPARE_MS = 800

    recognition.onstart = () => {
        console.log('[ASR-Native] onstart')
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, MIN_PREPARE_MS - elapsed)
        setTimeout(() => {
            if (listening) onReady()
        }, remaining)
    }

    recognition.onaudiostart = () => console.log('[ASR-Native] onaudiostart')
    recognition.onspeechstart = () => console.log('[ASR-Native] onspeechstart')
    recognition.onspeechend = () => console.log('[ASR-Native] onspeechend')
    recognition.onaudioend = () => console.log('[ASR-Native] onaudioend')

    recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = ''
        let latestInterim = ''
        for (let i = 0; i < event.results.length; i++) {
            const r = event.results[i]
            if (r.isFinal) {
                finalText += r[0].transcript
            } else {
                latestInterim = r[0].transcript
            }
        }
        if (latestInterim) {
            onResult({ text: finalText + latestInterim, isFinal: false })
        } else {
            onResult({ text: finalText, isFinal: true })
        }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log('[ASR-Native] onerror -', event.error)
        if (event.error === 'no-speech') {
            shouldRestart = !userStopped
            return
        }
        if (event.error === 'aborted') {
            shouldRestart = false
            listening = false
            onEnd()
            return
        }
        shouldRestart = false
        listening = false
        onError(event.error || '语音识别出错')
    }

    recognition.onend = () => {
        console.log('[ASR-Native] onend - shouldRestart:', shouldRestart)
        if (shouldRestart && listening && !userStopped) {
            shouldRestart = false
            try {
                recognition.start()
            } catch {
                listening = false
                onEnd()
            }
            return
        }
        shouldRestart = false
        listening = false
        onEnd()
    }

    return {
        start: () => {
            if (listening) return
            listening = true
            userStopped = false
            shouldRestart = false
            startTime = Date.now()
            try {
                recognition.start()
            } catch {
                listening = false
                onError('启动语音识别失败')
            }
        },
        stop: () => {
            if (!listening) return
            userStopped = true
            shouldRestart = false
            recognition.stop()
        },
        abort: () => {
            if (!listening) return
            userStopped = true
            shouldRestart = false
            recognition.abort()
            listening = false
        },
        isListening: () => listening,
    }
}

// ─── WebSocket Sherpa-onnx ASR 实现 ───

function createWebSocketRecognizer(wsUrl: string, options: SpeechRecognizerOptions): SpeechRecognizerHandle {
    const { onResult, onReady, onEnd, onError, mediaStream } = options

    let listening = false
    let ws: WebSocket | null = null
    let audioCtx: AudioContext | null = null
    let processor: ScriptProcessorNode | null = null
    let ownStream: MediaStream | null = null

    function cleanup() {
        processor?.disconnect()
        processor = null
        if (ownStream) {
            ownStream.getTracks().forEach(t => t.stop())
            ownStream = null
        }
        if (audioCtx && audioCtx.state !== 'closed') {
            audioCtx.close().catch(() => {})
        }
        audioCtx = null
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close()
        }
        ws = null
        listening = false
    }

    return {
        start: () => {
            if (listening) return
            listening = true

            const socket = new WebSocket(wsUrl)
            ws = socket
            socket.binaryType = 'arraybuffer'

            socket.onopen = async () => {
                console.log('[ASR-WS] connected')
                try {
                    const stream = mediaStream || await navigator.mediaDevices.getUserMedia({
                        audio: { sampleRate: 16000, channelCount: 1 },
                        video: false,
                    })
                    if (!mediaStream) ownStream = stream

                    audioCtx = new AudioContext({ sampleRate: 16000 })
                    const source = audioCtx.createMediaStreamSource(stream)
                    // 4096 samples @ 16kHz = 256ms 每块
                    processor = audioCtx.createScriptProcessor(4096, 1, 1)
                    processor.onaudioprocess = (e) => {
                        if (socket.readyState !== WebSocket.OPEN) return
                        const float32 = e.inputBuffer.getChannelData(0)
                        const int16 = new Int16Array(float32.length)
                        for (let i = 0; i < float32.length; i++) {
                            int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
                        }
                        socket.send(int16.buffer)
                    }
                    source.connect(processor)
                    processor.connect(audioCtx.destination)
                    onReady()
                } catch (e: any) {
                    console.error('[ASR-WS] mic error:', e)
                    cleanup()
                    onError('麦克风访问失败')
                }
            }

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === 'result') {
                        const text = (data.text || '').trim()
                        onResult({ text, isFinal: true })
                    }
                } catch {}
            }

            socket.onerror = () => {
                console.error('[ASR-WS] WebSocket error')
                cleanup()
                onError('语音识别服务连接失败')
            }

            socket.onclose = () => {
                console.log('[ASR-WS] disconnected')
                if (listening) {
                    listening = false
                    onEnd()
                }
            }
        },

        stop: () => {
            if (!listening) return
            // 发送识别请求，等结果回来后再关闭
            if (ws && ws.readyState === WebSocket.OPEN) {
                // 先停止发送音频
                processor?.disconnect()
                processor = null
                // 请求识别
                ws.send(JSON.stringify({ action: 'recognize' }))
                // 等结果回来后关闭（onmessage 中会收到 result）
                const origOnMessage = ws.onmessage
                const currentWs = ws
                currentWs.onmessage = (event) => {
                    origOnMessage?.call(currentWs, event)
                    // 收到识别结果后关闭
                    cleanup()
                    onEnd()
                }
                // 超时保护
                setTimeout(() => {
                    if (listening) {
                        cleanup()
                        onEnd()
                    }
                }, 5000)
            } else {
                cleanup()
                onEnd()
            }
        },

        abort: () => {
            cleanup()
            onEnd()
        },

        isListening: () => listening,
    }
}

// ─── 统一入口 ───

export function createSpeechRecognizer(options: SpeechRecognizerOptions): SpeechRecognizerHandle {
    const wsUrl = cachedAsrWsUrl
    if (wsUrl) {
        console.log('[ASR] 使用 WebSocket 模式:', wsUrl)
        return createWebSocketRecognizer(wsUrl, options)
    }
    console.log('[ASR] 使用 Chrome 原生模式')
    return createNativeRecognizer(options)
}
