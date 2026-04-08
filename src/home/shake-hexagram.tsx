import React, { ReactElement, useState, useRef, useCallback, useEffect } from 'react'
import { paths } from '../router/urls'
import { colors, fontSize, fontWeight, radius, spacing, brandAlpha } from '../styles/tokens'
import { hexagramList, hexagramName } from '../domain/hexagram'
import { sendProjectionMessage } from '../utils/projection-channel'
import { getBaziInfoStr, getCurrentTimeWuxing } from '../utils/bazi-store'
import { TTSPlayer } from '../utils/volcan-tts'
import { cleanLLMResponse } from '../common/utils'
import { saveBlessings } from '../utils/local-db'
import { getUserId } from '../utils/user-store'
import { createSpeechRecognizer, getAsrWsUrl } from '../utils/speech-recognition'
import { DoubaoRealtimeChat, type HexagramChatInputs } from '../utils/doubao-realtime'
import dify from '../utils/dify'
import { getAppConfig } from '../utils/api'
import BackButton from '../components/back-button'
import PrintSignCard from '../components/print-sign-card'
import { publicAssetUrl } from '../utils/public-asset-url'
import printer from '../utils/printer'
import { reportPiEventConsumerLog } from '../utils/pi-event-bridge'

const CARD_SIZE = 120
const BASE_SPIN_SPEED = 8
const MIN_SPIN_MS = 1000
const SLOT_STOP_DELAY = 200
const AUTO_STOP_MS = 3000
const SPECTRUM_BARS = 52

const SLOT_CONFIG = [
    { dir:  1, speed: 1.00 },
    { dir: -1, speed: 1.32 },
    { dir:  1, speed: 0.87 },
    { dir: -1, speed: 1.18 },
    { dir:  1, speed: 0.95 },
    { dir: -1, speed: 1.12 },
] as const

type Step = 'asking' | 'ready' | 'spinning' | 'interpreting' | 'result'

const TTS_VOICE_TYPE = 'zh_female_xiaohe_uranus_bigtts'

// TODO: 后续从 t_tengod_voice 查询
const TENGOD_NAME = '食神'

interface ReportData {
    reading: string
    inscription: [string, string]
    meaning: string
    blessings: Array<{ item: string; date: string }>
}

function previewText(text: string, max = 240): string {
    return text.length <= max ? text : `${text.slice(0, max)}...`
}

function formatErrorForLog(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack ? previewText(error.stack, 400) : undefined,
        }
    }
    return { message: String(error) }
}

interface SlotState {
    el: HTMLDivElement | null
    animId: number
    offset: number   // always in (-CARD_SIZE*2, 0]
    running: boolean
}

/* ─── Slot ─── */
// Cards: [yin='0', yang='1', yin='0', yang='1']
// Visible at offset 0 → yin; offset -CARD_SIZE → yang; offset -2*CARD_SIZE → yin (wraps)

function Slot({ isSpinning, shouldStop, slotIndex, onStopped }: {
    isSpinning: boolean
    shouldStop: boolean
    slotIndex: number
    onStopped?: (result: '0' | '1') => void
}): ReactElement {
    const cfg = SLOT_CONFIG[slotIndex]
    const st = useRef<SlotState>({ el: null, animId: 0, offset: 0, running: false })
    const t1 = useRef<ReturnType<typeof setTimeout>>()
    const t2 = useRef<ReturnType<typeof setTimeout>>()
    const t3 = useRef<ReturnType<typeof setTimeout>>()
    const t4 = useRef<ReturnType<typeof setTimeout>>()
    const [settled, setSettled] = useState(false)
    const stopping = useRef(false)
    const onStoppedRef = useRef(onStopped)
    onStoppedRef.current = onStopped   // always latest, no extra effect needed

    const cards: ('0' | '1')[] = ['0', '1', '0', '1']

    const animate = useCallback(() => {
        const s = st.current
        if (!s.el || !s.running) return
        s.offset -= cfg.dir * BASE_SPIN_SPEED * cfg.speed
        if (s.offset <= -(CARD_SIZE * 2)) s.offset += CARD_SIZE * 2
        if (s.offset > 0)                 s.offset -= CARD_SIZE * 2
        s.el.style.transform = `translateY(${s.offset}px)`
        s.animId = requestAnimationFrame(animate)
    }, [cfg])

    // Start spin
    useEffect(() => {
        const s = st.current
        clearTimeout(t1.current); clearTimeout(t2.current)
        clearTimeout(t3.current); clearTimeout(t4.current)
        stopping.current = false
        if (isSpinning) {
            s.running = true
            s.offset = -Math.random() * CARD_SIZE * 2  // 随机初始相位，避免每次摇出同一卦
            setSettled(false)
            if (s.el) { s.el.style.transition = 'none'; s.el.style.transform = `translateY(${s.offset}px)` }
            s.animId = requestAnimationFrame(animate)
        } else {
            s.running = false
            cancelAnimationFrame(s.animId)
        }
        return () => { s.running = false; cancelAnimationFrame(s.animId) }
    }, [isSpinning, animate])

    // Spring-stop when shouldStop fires
    useEffect(() => {
        if (!shouldStop || stopping.current) return
        stopping.current = true
        const s = st.current
        if (!s.el) return

        // Freeze rAF
        s.running = false
        cancelAnimationFrame(s.animId)
        const frozenOffset = s.offset

        // Commit frozen position to CSS
        s.el.style.transition = 'none'
        s.el.style.transform = `translateY(${frozenOffset}px)`
        void s.el.getBoundingClientRect()

        // Find nearest card boundary: 0, -CARD_SIZE, or -2*CARD_SIZE
        const nearestIdx = Math.round(-frozenOffset / CARD_SIZE)          // 0, 1, or 2
        const nearestOffset = -(nearestIdx * CARD_SIZE)                   // 0, -120, or -240
        const nearestResult: '0' | '1' = nearestIdx % 2 === 0 ? '0' : '1'
        const baseTarget = nearestResult === '1' ? -CARD_SIZE : 0         // normalised display pos

        // Two-phase spring stop: overshoot past target, then spring-decay back — no hard settle
        const overshoot = cfg.dir * CARD_SIZE * 1.8

        // Phase 1: rapid deceleration to overshoot point (220ms)
        s.el.style.transition = 'transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)'
        s.el.style.transform = `translateY(${nearestOffset + overshoot}px)`

        t1.current = setTimeout(() => {
            if (!s.el) return
            // Phase 2: spring back with natural decay — cubic-bezier(0.34,1.56,0.64,1)
            s.el.style.transition = 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)'
            s.el.style.transform = `translateY(${nearestOffset}px)`

            t2.current = setTimeout(() => {
                if (!s.el) return
                s.el.style.transition = 'none'
                s.el.style.transform = `translateY(${baseTarget}px)`
                s.offset = baseTarget
                setSettled(true)
                onStoppedRef.current?.(nearestResult)
            }, 400)
        }, 230)

        return () => {
            clearTimeout(t1.current); clearTimeout(t2.current)
            clearTimeout(t3.current); clearTimeout(t4.current)
        }
    }, [shouldStop, cfg])

    // opacity: dim when idle, semi-bright while spinning or stopping, full when settled
    const opacity   = (!isSpinning && !shouldStop && !settled) ? 0.2 : 1
    const imgFilter = settled ? 'brightness(1.3) saturate(1.2)' : 'none'

    return (
        <div style={slotContainerStyle}>
            <div ref={el => { st.current.el = el }} style={slotInnerStyle}>
                {cards.map((sym, i) => (
                    <div key={i} style={slotCardStyle}>
                        <img
                            src={sym === '1' ? publicAssetUrl('totem-yang.png') : publicAssetUrl('totem-yin.png')}
                            alt={sym === '1' ? '阳' : '阴'}
                            style={{ width: CARD_SIZE - 16, height: CARD_SIZE - 16, opacity, filter: imgFilter, transition: 'opacity 0.3s, filter 0.3s' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ─── AudioSpectrum ─── */

function AudioSpectrum({ canRecord, hasRecordedOnce, onRecordStart, onRecordEnd, onAudioData, onRecordStop }: {
    canRecord: boolean
    hasRecordedOnce: boolean
    onRecordStart?: () => void
    onRecordEnd: (transcript?: string) => void
    /** 实时 PCM 音频回调（16kHz int16 mono），用于豆包端到端模式 */
    onAudioData?: (pcm: ArrayBuffer) => void
    /** 录音结束回调（不含 ASR 结果），用于豆包端到端模式 */
    onRecordStop?: () => void
}) {
    const barsRef     = useRef<(HTMLDivElement | null)[]>([])
    const animRef     = useRef(0)
    const streamRef   = useRef<MediaStream | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const holdingRef  = useRef(false)
    const asrRef = useRef<ReturnType<typeof createSpeechRecognizer> | null>(null)
    const transcriptRef = useRef('')
    const pendingEndRef = useRef(false)
    const useWsAsrRef = useRef(false)
    const [isRecording, setIsRecording] = useState(false)

    // Mount: stagger bars to random static heights, then freeze
    useEffect(() => {
        const targets = Array.from({ length: SPECTRUM_BARS }, () => 6 + Math.random() * 26)
        barsRef.current.forEach((bar, i) => {
            if (!bar) return
            bar.style.transition = `height 0.5s ease ${i * 6}ms`
            requestAnimationFrame(() => { if (bar) bar.style.height = `${targets[i]}px` })
        })
        const tid = setTimeout(() => {
            barsRef.current.forEach(bar => { if (bar) bar.style.transition = 'none' })
        }, SPECTRUM_BARS * 6 + 650)
        return () => clearTimeout(tid)
    }, [])

    // 预加载 ASR 配置，判断是否使用 WebSocket 模式
    useEffect(() => {
        getAsrWsUrl().then(url => { useWsAsrRef.current = !!url })
    }, [])

    const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null)
    const pcmCtxRef = useRef<AudioContext | null>(null)

    const startRecording = useCallback(async () => {
        if (holdingRef.current || !canRecord) return
        holdingRef.current = true
        setIsRecording(true)
        transcriptRef.current = ''
        onRecordStart?.()
        barsRef.current.forEach(bar => { if (bar) bar.style.transition = 'none' })

        const useDoubaoMode = !!onAudioData

        try {
            // 先获取麦克风流（频谱可视化和 ASR/豆包共用）
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            if (!holdingRef.current) { stream.getTracks().forEach(t => t.stop()); return }
            streamRef.current = stream

            if (useDoubaoMode) {
                // 豆包端到端模式：发送 PCM 数据到回调
                const pcmCtx = new AudioContext({ sampleRate: 16000 })
                pcmCtxRef.current = pcmCtx
                const pcmSource = pcmCtx.createMediaStreamSource(stream)
                const processor = pcmCtx.createScriptProcessor(4096, 1, 1)
                processor.onaudioprocess = (e) => {
                    if (!holdingRef.current) return
                    const float32 = e.inputBuffer.getChannelData(0)
                    const int16 = new Int16Array(float32.length)
                    for (let i = 0; i < float32.length; i++) {
                        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
                    }
                    onAudioData(int16.buffer)
                }
                pcmSource.connect(processor)
                processor.connect(pcmCtx.destination)
                pcmProcessorRef.current = processor
            } else {
                // ASR 模式：启动语音识别
                const asr = createSpeechRecognizer({
                    onResult: (result) => { transcriptRef.current = result.text },
                    onReady: () => console.log('[AudioSpectrum] ASR ready'),
                    onEnd: () => {
                        console.log('[AudioSpectrum] ASR ended')
                        if (pendingEndRef.current) {
                            pendingEndRef.current = false
                            const text = transcriptRef.current.trim()
                            transcriptRef.current = ''
                            onRecordEnd(text || undefined)
                        }
                    },
                    onError: (err) => console.warn('[AudioSpectrum] ASR error:', err),
                    mediaStream: useWsAsrRef.current ? stream : undefined,
                })
                asrRef.current = asr
                asr.start()
            }

            // 频谱可视化
            const ctx = new AudioContext()
            audioCtxRef.current = ctx
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 256
            analyser.smoothingTimeConstant = 0.78
            source.connect(analyser)
            analyserRef.current = analyser
            const data = new Uint8Array(analyser.frequencyBinCount)
            const half = Math.floor(SPECTRUM_BARS / 2)
            const draw = () => {
                if (!holdingRef.current) return
                analyser.getByteFrequencyData(data)
                barsRef.current.forEach((bar, i) => {
                    if (!bar) return
                    const distFromCenter = Math.abs(i - half) / half
                    const idx = Math.min(Math.floor(Math.pow(distFromCenter, 0.7) * data.length), data.length - 1)
                    const val = data[idx]
                    const h = val > 8 ? 4 + ((val - 8) / (255 - 8)) * 48 : 4
                    bar.style.height = `${h}px`
                })
                animRef.current = requestAnimationFrame(draw)
            }
            animRef.current = requestAnimationFrame(draw)
        } catch {
            holdingRef.current = false
            setIsRecording(false)
        }
    }, [canRecord, onRecordStart, onAudioData])

    const stopRecording = useCallback(() => {
        if (!holdingRef.current) return
        holdingRef.current = false
        setIsRecording(false)
        cancelAnimationFrame(animRef.current)
        audioCtxRef.current?.close()
        audioCtxRef.current = null
        analyserRef.current = null

        // 停止 PCM 处理（豆包模式）
        pcmProcessorRef.current?.disconnect()
        pcmProcessorRef.current = null
        if (pcmCtxRef.current && pcmCtxRef.current.state !== 'closed') {
            pcmCtxRef.current.close().catch(() => {})
        }
        pcmCtxRef.current = null

        if (onRecordStop) {
            // 豆包端到端模式：通知录音结束
            onRecordStop()
        } else {
            // ASR 模式
            const asr = asrRef.current
            asrRef.current = null
            if (asr) {
                if (useWsAsrRef.current) {
                    pendingEndRef.current = true
                    asr.stop()
                } else {
                    asr.stop()
                    const transcript = transcriptRef.current.trim()
                    transcriptRef.current = ''
                    onRecordEnd(transcript || undefined)
                }
            } else {
                onRecordEnd(undefined)
            }
        }

        // 关闭麦克风流
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
    }, [onRecordEnd, onRecordStop])

    // Spacebar = physical key
    useEffect(() => {
        const down = (e: KeyboardEvent) => { if (e.code !== 'Space' || e.repeat) return; e.preventDefault(); startRecording() }
        const up   = (e: KeyboardEvent) => { if (e.code !== 'Space') return; e.preventDefault(); stopRecording() }
        window.addEventListener('keydown', down)
        window.addEventListener('keyup', up)
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    }, [startRecording, stopRecording])

    // Reason: 硬件语音按键 → 和空格键同样调用 startRecording/stopRecording
    useEffect(() => {
        const onStart = (event: Event) => {
            const detail = event instanceof CustomEvent ? event.detail : undefined
            reportPiEventConsumerLog('consumer:shake', 'record.start', detail)
            void startRecording()
        }
        const onStop = (event: Event) => {
            const detail = event instanceof CustomEvent ? event.detail : undefined
            reportPiEventConsumerLog('consumer:shake', 'record.stop', detail)
            stopRecording()
        }
        window.addEventListener('pi:record.start', onStart)
        window.addEventListener('pi:record.stop', onStop)
        return () => {
            window.removeEventListener('pi:record.start', onStart)
            window.removeEventListener('pi:record.stop', onStop)
        }
    }, [startRecording, stopRecording])

    const barBg = isRecording ? colors.brand.main : brandAlpha(0.32)

    return (
        <div style={spectrumWrapStyle}>
            <p style={spectrumLabelStyle}>
                {isRecording ? '正在收音...' : hasRecordedOnce ? '按住语音键可继续补充' : '按住语音键说话'}
            </p>
            <div style={spectrumBarsStyle}>
                {Array.from({ length: SPECTRUM_BARS }, (_, i) => (
                    <div
                        key={i}
                        ref={el => { barsRef.current[i] = el }}
                        style={{ width: '4px', height: '4px', background: barBg, borderRadius: '2px', flexShrink: 0, transition: 'background 0.2s' }}
                    />
                ))}
            </div>
        </div>
    )
}

/* ─── Main page ─── */

export default function ShakeHexagram(): ReactElement {
    const [step, setStep] = useState<Step>('asking')
    const [stoppingMask, setStoppingMask] = useState<boolean[]>(Array(6).fill(false))
    const [collectedResults, setCollectedResults] = useState<Array<'0' | '1' | null>>(Array(6).fill(null))
    const [spinning, setSpinning] = useState<boolean[]>(Array(6).fill(false))
    const spinStartRef = useRef(0)
    const stopTimers = useRef<ReturnType<typeof setTimeout>[]>([])
    const [reportData, setReportData] = useState<ReportData | null>(null)
    const [streamingReading, setStreamingReading] = useState('')
    const [_ttsPlaying, setTtsPlaying] = useState(false)
    const ttsPlayerRef = useRef<TTSPlayer | null>(null)
    const doubaoRef = useRef<DoubaoRealtimeChat | null>(null)
    const [doubaoReady, setDoubaoReady] = useState(false)
    const autoStopTimerRef = useRef<ReturnType<typeof setTimeout>>()
    const questionRef = useRef('')
    const [hasRecordedOnce, setHasRecordedOnce] = useState(false)

    // 页面卸载时停止 TTS 和豆包连接
    useEffect(() => {
        return () => {
            ttsPlayerRef.current?.stop()
            doubaoRef.current?.close()
        }
    }, [])

    // upper = collectedResults[3..5], lower = collectedResults[0..2]
    // value = upper + lower, matching App's hexagram = upperHexagram + lowerHexagram
    const hexagramValue = collectedResults.every(r => r !== null)
        ? collectedResults.slice(3).join('') + collectedResults.slice(0, 3).join('')
        : null
    const hexagramEntry = hexagramValue
        ? (hexagramList.find(h => h.value === hexagramValue) ?? null)
        : null

    // 打断：停止 TTS + 停止豆包输出
    const interrupt = useCallback(() => {
        ttsPlayerRef.current?.stop()
        doubaoRef.current?.interrupt()
        sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
    }, [])

    // 进入 result 步骤时初始化豆包端到端会话
    useEffect(() => {
        if (step !== 'result' || !reportData || !hexagramEntry || !hexagramValue) return

        const upper = hexagramValue.slice(3)
        const lower = hexagramValue.slice(0, 3)
        const hexagramDesc = `${hexagramEntry.name}（上${hexagramName[upper]}下${hexagramName[lower]}）`

        const config = (window as any).APP_CONFIG ?? {}
        const doubao = new DoubaoRealtimeChat({
            appId: config.DOUBAO?.APP_ID ?? '',
            accessKey: config.DOUBAO?.ACCESS_KEY ?? '',
            speaker: config.DOUBAO?.SPEAKER,
            botName: '食神',
        })
        doubao.onStateChange = (state) => {
            console.log('[Doubao] state:', state)
            if (state === 'speaking') {
                setTtsPlaying(true)
                sendProjectionMessage({ type: 'trigger_scene', scene: 'interpret' })
            } else if (state === 'idle' || state === 'closed') {
                setTtsPlaying(false)
                sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
            }
        }
        doubao.onTTSStateChange = (playing) => {
            setTtsPlaying(playing)
            if (playing) {
                sendProjectionMessage({ type: 'trigger_scene', scene: 'interpret' })
            } else {
                sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
            }
        }
        doubao.onASRText = (text, isFinal) => {
            console.log('[Doubao] ASR:', text, isFinal ? '(final)' : '(interim)')
        }
        doubao.onChatText = (text) => {
            console.log('[Doubao] Chat:', text)
        }

        const inputs: HexagramChatInputs = {
            scene: 'hexagram',
            hexagram: hexagramDesc,
            reading: reportData.reading,
            inscription: reportData.inscription.join(''),
            meaning: reportData.meaning,
            userBazi: getBaziInfoStr(),
            currentTime: getCurrentTimeWuxing(),
            tengodName: TENGOD_NAME,
        }

        doubao.startSession(inputs)
            .then(() => {
                console.log('[Doubao] Session ready')
                doubaoRef.current = doubao
                setDoubaoReady(true)
            })
            .catch((e) => {
                console.error('[Doubao] Session init failed:', e)
                // fallback: doubaoRef 保持 null，录音仍走 ASR + Dify
            })

        return () => {
            doubao.close()
            if (doubaoRef.current === doubao) doubaoRef.current = null
            setDoubaoReady(false)
        }
    }, [step, reportData, hexagramEntry, hexagramValue])

    // 豆包端到端音频发送回调
    const handleDoubaoAudio = useCallback((pcm: ArrayBuffer) => {
        doubaoRef.current?.sendAudio(pcm)
    }, [])

    // 豆包端到端录音结束回调
    const handleDoubaoRecordStop = useCallback(() => {
        doubaoRef.current?.endAudio()
    }, [])

    const stopSpinning = useCallback(() => {
        clearTimeout(autoStopTimerRef.current)
        const elapsed   = Date.now() - spinStartRef.current
        const remaining = Math.max(0, MIN_SPIN_MS - elapsed)
        stopTimers.current.forEach(clearTimeout)
        const stopOrder = [0, 1, 2, 3, 4, 5]
        stopTimers.current = stopOrder.map((i, seq) =>
            setTimeout(() => {
                setStoppingMask(prev => { const next = [...prev]; next[i] = true; return next })
                setSpinning(prev   => { const next = [...prev]; next[i] = false; return next })
            }, remaining + seq * SLOT_STOP_DELAY)
        )
    }, [])

    const startSpinning = useCallback(() => {
        if (step !== 'ready') return // Reason: 防御性守卫，硬件事件可能绕过 UI 状态
        setStep('spinning')
        setCollectedResults(Array(6).fill(null))
        setStoppingMask(Array(6).fill(false))
        setSpinning(Array(6).fill(true))
        spinStartRef.current = Date.now()
        autoStopTimerRef.current = setTimeout(stopSpinning, AUTO_STOP_MS)
    }, [step, stopSpinning])

    // Reason: 硬件摇杆触发 → 和 UI 按钮同样调用 startSpinning（守卫在 startSpinning 内部）
    useEffect(() => {
        const onShake = (event: Event) => {
            const detail = event instanceof CustomEvent ? event.detail : undefined
            reportPiEventConsumerLog('consumer:shake', 'shake.trigger', detail)
            startSpinning()
        }
        window.addEventListener('pi:shake.trigger', onShake)
        return () => window.removeEventListener('pi:shake.trigger', onShake)
    }, [startSpinning])

    const handleRecordEnd = useCallback((transcript?: string) => {
        if (transcript) setHasRecordedOnce(true)
        if (step === 'asking' || step === 'ready') {
            if (transcript) {
                questionRef.current = transcript
                console.log('[摇卦] question:', transcript)
                setStep('ready')
            }
        }
        // result 步骤完全走豆包端到端，不再 fallback Dify
    }, [step])

    const onSlotStopped = useCallback((index: number, result: '0' | '1') => {
        setCollectedResults(prev => {
            const next = [...prev]
            next[index] = result
            if (next.every(r => r !== null)) {
                setTimeout(() => {
                    setStep('interpreting')
                    sendProjectionMessage({ type: 'trigger_scene', scene: 'casting' })
                }, 400)
            }
            return next
        })
    }, [])

    // 卦象出来后调用 Dify 解卦（blocking 模式）
    useEffect(() => {
        if (step !== 'interpreting' || !hexagramEntry || !hexagramValue) return

        let cancelled = false
        const upper = hexagramValue.slice(3)
        const lower = hexagramValue.slice(0, 3)
        const hexagramDesc = `${hexagramEntry.name}（上${hexagramName[upper]}下${hexagramName[lower]}）`
        const hexagramNameForLog = hexagramEntry.name

        async function fetchReport() {
            const config = await getAppConfig()
            let answerText = ''
            const question = questionRef.current || '请解卦'

            reportPiEventConsumerLog('consumer:shake', 'report.request.start', {
                question,
                hexagramDesc,
                hexagramValue,
                difyBaseUrl: config.DIFY?.BASE_URL ?? '',
                hasHexagramReportKey: Boolean(config.DIFY?.HEXAGRAM_REPORT_KEY),
            })

            try {
                const result = await dify.completionMessages(
                    { apiKey: config.DIFY?.HEXAGRAM_REPORT_KEY ?? '', baseUrl: config.DIFY?.BASE_URL ?? '' }, {
                    inputs: {
                        question,
                        current_time: getCurrentTimeWuxing(),
                        user_bazi_info: getBaziInfoStr(),
                        hexagram: hexagramDesc,
                        tengod_name: TENGOD_NAME,
                        tengod_persona: '温润、松弛、细腻、会表达、懂安抚、懂生活感、善于把抽象问题说得让人容易接受',
                        tengod_accent: '你说话要像一个温润、松弛、细腻、有表达力的女性。语气自然，偏口语，温和但不油腻，善于安抚情绪，擅长把抽象的命理内容讲得有人味、好理解。先说结论，再讲依据，最后给建议。不要故作玄虚，不要恐吓，不要过度夸大吉凶，不要生硬说教。',
                    },
                    user: getUserId(),
                    files: [],
                    response_mode: 'blocking',
                })

                if (cancelled) return

                answerText = (result.answer ?? '').trim()
                console.log('[解卦] blocking 返回长度:', answerText.length, '预览:', answerText.substring(0, 300))
                reportPiEventConsumerLog('consumer:shake', 'report.request.success', {
                    answerLength: answerText.length,
                    answerPreview: previewText(answerText),
                })

                const jsonStr = cleanLLMResponse(answerText)
                if (!jsonStr) throw new Error('Dify 返回内容为空')
                reportPiEventConsumerLog('consumer:shake', 'report.json.cleaned', {
                    jsonLength: jsonStr.length,
                    jsonPreview: previewText(jsonStr),
                })

                const data = JSON.parse(jsonStr) as ReportData
                reportPiEventConsumerLog('consumer:shake', 'report.parse.success', {
                    inscription: data.inscription,
                    meaning: data.meaning,
                    readingLength: data.reading?.length ?? 0,
                    blessingsCount: data.blessings?.length ?? 0,
                })
                if (!cancelled) {
                    setReportData(data)
                    setStep('result')
                    setStreamingReading(data.reading)
                }

                // 保存赐福事项到本地数据库
                if (data.blessings.length > 0) {
                    reportPiEventConsumerLog('consumer:shake', 'report.blessings.save.start', {
                        blessingsCount: data.blessings.length,
                        hexagramName: hexagramNameForLog,
                        question,
                    })
                    saveBlessings(data.blessings, hexagramNameForLog, question).catch(e => {
                        reportPiEventConsumerLog('consumer:shake', 'report.blessings.save.failed', {
                            error: formatErrorForLog(e),
                            blessingsCount: data.blessings.length,
                            hexagramName: hexagramNameForLog,
                        })
                        console.error('保存赐福事项失败:', e)
                    })
                }

                // TTS 播放解读 — onStateChange 同步副屏
                const ttsPlayer = new TTSPlayer(TTS_VOICE_TYPE, (playing) => {
                    setTtsPlaying(playing)
                    if (playing) {
                        sendProjectionMessage({ type: 'trigger_scene', scene: 'interpret' })
                    } else {
                        sendProjectionMessage({ type: 'trigger_scene', scene: 'idle' })
                    }
                })
                ttsPlayerRef.current = ttsPlayer
                ttsPlayer.feed(data.reading)
                ttsPlayer.flush()
            } catch (e) {
                reportPiEventConsumerLog('consumer:shake', 'report.request.failed', {
                    error: formatErrorForLog(e),
                    question,
                    hexagramDesc,
                    answerLength: answerText.length,
                    answerPreview: previewText(answerText, 500),
                })
                console.error('解卦失败:', e, '\nanswerText长度:', answerText.length, '\n预览:', answerText.substring(0, 500))
                if (!cancelled) {
                    setReportData({
                        reading: '解卦出了点问题，请重新摇卦试试。',
                        inscription: ['重新一试', ''] as [string, string],
                        meaning: '稍后再来',
                        blessings: [],
                    })
                    setStreamingReading('解卦出了点问题，请重新摇卦试试。')
                    setStep('result')
                }
            }
        }

        fetchReport()
        return () => { cancelled = true }
    }, [step, hexagramEntry])

    let title    = '请告诉我\n你的问题'
    let subtitle = ''
    let content  = ''

    const hexagramTitle = hexagramEntry && hexagramValue
        ? `上${hexagramName[hexagramValue.slice(0, 3)]}下${hexagramName[hexagramValue.slice(3)]}，是为『${hexagramEntry.name}』`
        : ''

    if (step === 'asking') {
        title    = '你想问什么？'
        subtitle = '一事一问，莫纠结，勿多疑'
    } else if (step === 'ready') {
        title    = '获取卦象指引'
        subtitle = '拉动拉杆，摇取卦象'
    } else if (step === 'spinning') {
        title    = '正在摇卦...'
        subtitle = '感受天地气运，卦象即将显现'
    } else if (step === 'interpreting') {
        title    = hexagramTitle || '卦象解读中...'
        subtitle = '卦象解读中，请静心等待...'
    } else if (step === 'result' && reportData) {
        title    = hexagramTitle || reportData.inscription.join('')
        subtitle = reportData.meaning
        content  = streamingReading
    }

    const showSpectrum = step === 'asking' || step === 'ready' || step === 'result'

    return (
        <div style={pageStyle}>
            <BackButton to={paths.home.index} />

            <div style={topSectionStyle}>
                {/* Left */}
                <div style={leftPanelStyle}>
                    <div style={leftScrollStyle}>
                        <div style={leftContentInnerStyle}>
                            <h1 style={titleStyle}>{title}</h1>
                            {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
                            {content  && <p style={contentStyle}>{content}</p>}
                            {step === 'result' && reportData && reportData.blessings.length > 0 && (
                                <div style={blessingsWrapStyle}>
                                    <span style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: '4px' }}>祈福事项</span>
                                    {reportData.blessings.map((b, i) => (
                                        <div key={i} style={blessingItemStyle}>
                                            <span style={blessingDateStyle}>{b.date}</span>
                                            <span style={blessingTextStyle}>{b.item}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {step === 'ready' && (
                        <button onClick={startSpinning} style={leverAbsStyle}>⟳ 摇动杠杆</button>
                    )}
                </div>

                {/* Right: 6 slots */}
                <div style={rightPanelStyle}>
                    <div style={hexagramGridStyle}>
                        <div style={slotsRowStyle}>
                            {[3, 4, 5].map(i => (
                                <Slot
                                    key={i}
                                    slotIndex={i}
                                    isSpinning={spinning[i]}
                                    shouldStop={stoppingMask[i]}
                                    onStopped={result => onSlotStopped(i, result)}
                                />
                            ))}
                        </div>
                        <div style={slotsRowStyle}>
                            {[0, 1, 2].map(i => (
                                <Slot
                                    key={i}
                                    slotIndex={i}
                                    isSpinning={spinning[i]}
                                    shouldStop={stoppingMask[i]}
                                    onStopped={result => onSlotStopped(i, result)}
                                />
                            ))}
                        </div>
                    </div>

                    {step === 'result' && reportData && hexagramEntry && (
                        <div style={cardOverlayStyle}>
                            <PrintSignCard
                                topText="六十四卦"
                                line1={reportData.inscription[0]}
                                line2={reportData.inscription[1] || hexagramEntry.name + '卦'}
                                bottomText={hexagramEntry.name + ' 卦'}
                                accentColor={colors.brand.main}
                                onPrint={() => printer.print(
                                    reportData.inscription[0],
                                    reportData.inscription[1] || hexagramEntry.name + '卦',
                                )}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div style={{ ...bottomSectionStyle, visibility: showSpectrum ? 'visible' : 'hidden' }}>
                <AudioSpectrum
                    canRecord={step === 'asking' || step === 'ready' || step === 'result'}
                    hasRecordedOnce={hasRecordedOnce}
                    onRecordStart={interrupt}
                    onRecordEnd={handleRecordEnd}
                    onAudioData={step === 'result' && doubaoReady ? handleDoubaoAudio : undefined}
                    onRecordStop={step === 'result' && doubaoReady ? handleDoubaoRecordStop : undefined}
                />
            </div>
        </div>
    )
}

/* ─── Styles ─── */

const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: `0px 80px`,
    overflow: 'hidden',
    position: 'relative',
    boxSizing: 'border-box',
}

const topSectionStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    gap: `${spacing.xs}px`,
    minHeight: 0,
}

const bottomSectionStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: `32px`,
    left: '80px',
    right: '80px',
    height: '80px',
    pointerEvents: 'none',
}

const leftPanelStyle: React.CSSProperties = {
    flex: 6,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
}

const leftScrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: `64px 0 ${spacing.lg}px`,
}

// Inner wrapper uses margin:auto to vertically center short content,
// while long content just overflows and is scrollable.
const leftContentInnerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.md}px`,
    margin: 'auto 0',
}

const rightPanelStyle: React.CSSProperties = {
    flex: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
}

const titleStyle: React.CSSProperties = {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    margin: 0,
    whiteSpace: 'pre-line',
    lineHeight: 1.3,
}

const subtitleStyle: React.CSSProperties = {
    fontSize: fontSize.base,
    color: colors.text.muted,
    margin: 0,
    letterSpacing: '0.5px',
    lineHeight: 1.6,
}

const contentStyle: React.CSSProperties = {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: 1.8,
    margin: 0,
    whiteSpace: 'pre-line',
}

const leverAbsStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 160,
    left: 0,
    padding: `${spacing.sm}px ${spacing.xl}px`,
    background: colors.brand.main,
    border: 'none',
    borderRadius: radius.md,
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    cursor: 'pointer',
    letterSpacing: '2px',
}

const hexagramGridStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.xs}px`,
    padding: `${spacing.sm}px`,
    background: colors.bg.overlay,
    borderRadius: radius.md,
}

const slotsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${spacing.xs}px`,
}

const slotContainerStyle: React.CSSProperties = {
    width: CARD_SIZE,
    height: CARD_SIZE,
    overflow: 'hidden',
    borderRadius: radius.sm,
    border: `1px solid ${colors.brand.borderStrong}`,
    background: colors.bg.surface,
    position: 'relative',
}

const slotInnerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
}

const slotCardStyle: React.CSSProperties = {
    width: CARD_SIZE,
    height: CARD_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
}

const cardOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.72)',
    borderRadius: radius.xl,
    backdropFilter: 'blur(8px)',
}

/* Spectrum */

const spectrumWrapStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: '80px',
    boxSizing: 'border-box',
}

const spectrumLabelStyle: React.CSSProperties = {
    margin: 0,
    fontSize: fontSize.xs,
    color: colors.text.muted,
    letterSpacing: '1px',
    textAlign: 'center',
    flexShrink: 0,
}

const spectrumBarsStyle: React.CSSProperties = {
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
}

const blessingsWrapStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
    marginTop: `${spacing.sm}px`,
}

const blessingItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    padding: `${spacing.xs}px ${spacing.sm}px`,
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.md,
}

const blessingTextStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
}

const blessingDateStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: colors.text.muted,
}
