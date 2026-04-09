import React, { ReactElement, useEffect, useRef, useState } from 'react'
import { colors, fontSize, spacing } from '../styles/tokens'

const RESULT_BAR_COUNT = 52

interface ResultVoiceBarProps {
    enabled?: boolean
    onRecordStart?: () => void
    onAudioData?: (pcm: ArrayBuffer) => void
    onRecordStop?: () => void
    idleLabel?: string
    recordingLabel?: string
    pendingLabel?: string
}

export default function ResultVoiceBar({
    enabled = true,
    onRecordStart,
    onAudioData,
    onRecordStop,
    idleLabel = '按住语音键可继续对话',
    recordingLabel = '正在录音...',
    pendingLabel = '语音对话准备中...',
}: ResultVoiceBarProps): ReactElement {
    const [recording, setRecording] = useState(false)
    const barsRef = useRef<(HTMLDivElement | null)[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const ctxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const visualCtxRef = useRef<AudioContext | null>(null)
    const animRef = useRef(0)

    useEffect(() => {
        const targets = Array.from({ length: RESULT_BAR_COUNT }, () => 6 + Math.random() * 26)
        barsRef.current.forEach((bar, index) => {
            if (!bar) return
            bar.style.transition = `height 0.5s ease ${index * 6}ms`
            requestAnimationFrame(() => {
                if (bar) bar.style.height = `${targets[index]}px`
            })
        })
        const tid = setTimeout(() => {
            barsRef.current.forEach(bar => {
                if (bar) bar.style.transition = 'none'
            })
        }, RESULT_BAR_COUNT * 6 + 650)
        return () => clearTimeout(tid)
    }, [])

    useEffect(() => {
        const beginRecording = async () => {
            if (recording || !enabled) return
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

                const visualCtx = new AudioContext()
                visualCtxRef.current = visualCtx
                const visualSource = visualCtx.createMediaStreamSource(stream)
                const analyser = visualCtx.createAnalyser()
                analyser.fftSize = 256
                analyser.smoothingTimeConstant = 0.78
                visualSource.connect(analyser)
                analyserRef.current = analyser
                const data = new Uint8Array(analyser.frequencyBinCount)
                const half = Math.floor(RESULT_BAR_COUNT / 2)
                const draw = () => {
                    if (!analyserRef.current) return
                    analyserRef.current.getByteFrequencyData(data)
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
            } catch (err) {
                console.error('麦克风获取失败:', err)
                setRecording(false)
            }
        }

        const finishRecording = () => {
            if (!recording) return
            setRecording(false)
            cancelAnimationFrame(animRef.current)
            processorRef.current?.disconnect()
            streamRef.current?.getTracks().forEach(t => t.stop())
            ctxRef.current?.close().catch(() => {})
            visualCtxRef.current?.close().catch(() => {})
            processorRef.current = null
            streamRef.current = null
            ctxRef.current = null
            visualCtxRef.current = null
            analyserRef.current = null
            onRecordStop?.()
        }

        const startRecording = async (e: KeyboardEvent) => {
            if (e.code !== 'Space' || e.repeat) return
            e.preventDefault()
            await beginRecording()
        }

        const stopRecording = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return
            e.preventDefault()
            finishRecording()
        }

        const onHardwareStart = () => { void beginRecording() }
        const onHardwareStop = () => { finishRecording() }

        window.addEventListener('keydown', startRecording)
        window.addEventListener('keyup', stopRecording)
        window.addEventListener('pi:record.start', onHardwareStart)
        window.addEventListener('pi:record.stop', onHardwareStop)
        return () => {
            window.removeEventListener('keydown', startRecording)
            window.removeEventListener('keyup', stopRecording)
            window.removeEventListener('pi:record.start', onHardwareStart)
            window.removeEventListener('pi:record.stop', onHardwareStop)
            cancelAnimationFrame(animRef.current)
            processorRef.current?.disconnect()
            streamRef.current?.getTracks().forEach(t => t.stop())
            ctxRef.current?.close().catch(() => {})
            visualCtxRef.current?.close().catch(() => {})
        }
    }, [enabled, recording, onRecordStart, onAudioData, onRecordStop])

    const barColor = recording
        ? colors.brand.main
        : enabled
            ? 'rgba(247, 239, 225, 0.46)'
            : 'rgba(247, 239, 225, 0.24)'

    const label = recording
        ? recordingLabel
        : enabled
            ? idleLabel
            : pendingLabel

    return (
        <div style={wrapStyle}>
            <p style={{ ...labelStyle, opacity: enabled || recording ? 1 : 0.72 }}>{label}</p>
            <div style={barsStyle}>
                {Array.from({ length: RESULT_BAR_COUNT }, (_, i) => (
                    <div
                        key={i}
                        ref={el => { barsRef.current[i] = el }}
                        style={{
                            width: '5px',
                            height: '4px',
                            background: barColor,
                            borderRadius: '999px',
                            flexShrink: 0,
                            transition: 'background 0.2s',
                        }}
                    />
                ))}
            </div>
        </div>
    )
}

const wrapStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    minHeight: '84px',
    padding: `${spacing.md}px ${spacing.lg}px`,
    background: 'rgba(0, 0, 0, 0.42)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
    margin: 0,
    fontSize: fontSize.md,
    color: '#F7EFE1',
    letterSpacing: '0.8px',
    lineHeight: 1.5,
    textAlign: 'left',
    flexShrink: 0,
}

const barsStyle: React.CSSProperties = {
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
}
