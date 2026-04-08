import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import { DoubaoRealtimeChat, ChatInputs } from '../utils/doubao-realtime'
import { colors, fontSize, fontWeight, radius, spacing } from '../styles/tokens'
import { getAppConfig } from '../utils/api'
import BackButton from '../components/back-button'

type RealtimeState = 'disconnected' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking'

type LogEntry = {
    time: string
    type: 'system' | 'asr' | 'chat' | 'tts' | 'error'
    text: string
}

function timeStr(): string {
    const d = new Date()
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

export default function DoubaoRealtimeDemo(): ReactElement {
    const [state, setState] = useState<RealtimeState>('disconnected')
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [asrText, setAsrText] = useState('')
    const [chatText, setChatText] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [systemRole, setSystemRole] = useState('你是一个友好的语音助手，用简短口语化的中文回答问题，每次回答不超过100字。')
    const [connected, setConnected] = useState(false)

    const doubaoRef = useRef<DoubaoRealtimeChat | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const holdingRef = useRef(false)
    const logsEndRef = useRef<HTMLDivElement>(null)

    const addLog = useCallback((type: LogEntry['type'], text: string) => {
        setLogs(prev => [...prev.slice(-100), { time: timeStr(), type, text }])
    }, [])

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [logs])

    // 清理
    useEffect(() => {
        return () => {
            doubaoRef.current?.close()
            streamRef.current?.getTracks().forEach(t => t.stop())
            audioCtxRef.current?.close().catch(() => {})
        }
    }, [])

    // 连接
    const connect = useCallback(async () => {
        if (doubaoRef.current) {
            doubaoRef.current.close()
            doubaoRef.current = null
        }
        setState('connecting')
        addLog('system', '正在连接豆包端到端...')

        const config = await getAppConfig()
        const doubao = new DoubaoRealtimeChat({
            appId: config.DOUBAO?.APP_ID ?? '',
            accessKey: config.DOUBAO?.ACCESS_KEY ?? '',
            speaker: config.DOUBAO?.SPEAKER,
            botName: '灵灵',
        })

        doubao.onStateChange = (s) => {
            addLog('system', `状态: ${s}`)
            if (s === 'closed') {
                setState('disconnected')
                setConnected(false)
            } else if (s === 'idle') {
                setState('idle')
            } else if (s === 'listening') {
                setState('listening')
            } else if (s === 'thinking') {
                setState('thinking')
            } else if (s === 'speaking') {
                setState('speaking')
            }
        }

        doubao.onTTSStateChange = (playing) => {
            addLog('tts', playing ? '开始播放' : '播放结束')
        }

        doubao.onASRText = (text, isFinal) => {
            setAsrText(text)
            addLog('asr', `${isFinal ? '[最终]' : '[中间]'} ${text}`)
        }

        doubao.onChatText = (text) => {
            setChatText(prev => prev + text)
            addLog('chat', text)
        }

        const inputs: ChatInputs = {
            scene: 'hexagram',
            hexagram: '',
            reading: '',
            inscription: '',
            meaning: '',
            userBazi: '',
            currentTime: new Date().toLocaleString('zh-CN'),
            tengodName: '灵灵',
            tengodPersona: '',
            tengodAccent: '',
        }

        try {
            await doubao.startSession(inputs)
            doubaoRef.current = doubao
            setConnected(true)
            setState('idle')
            addLog('system', '连接成功，可以开始对话')
        } catch (e: any) {
            addLog('error', `连接失败: ${e.message}`)
            setState('disconnected')
        }
    }, [addLog, systemRole])

    // 断开
    const disconnect = useCallback(() => {
        doubaoRef.current?.close()
        doubaoRef.current = null
        setConnected(false)
        setState('disconnected')
        addLog('system', '已断开连接')
    }, [addLog])

    // 开始录音
    const startRecording = useCallback(async () => {
        if (!doubaoRef.current || holdingRef.current) return
        holdingRef.current = true
        setIsRecording(true)
        setAsrText('')
        setChatText('')

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            streamRef.current = stream

            const ctx = new AudioContext({ sampleRate: 16000 })
            audioCtxRef.current = ctx
            const source = ctx.createMediaStreamSource(stream)
            const processor = ctx.createScriptProcessor(4096, 1, 1)
            processor.onaudioprocess = (e) => {
                if (!holdingRef.current || !doubaoRef.current) return
                const float32 = e.inputBuffer.getChannelData(0)
                const int16 = new Int16Array(float32.length)
                for (let i = 0; i < float32.length; i++) {
                    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
                }
                doubaoRef.current.sendAudio(int16.buffer)
            }
            source.connect(processor)
            processor.connect(ctx.destination)
            processorRef.current = processor

            addLog('system', '开始录音...')
        } catch (e: any) {
            addLog('error', `麦克风访问失败: ${e.message}`)
            holdingRef.current = false
            setIsRecording(false)
        }
    }, [addLog])

    // 停止录音
    const stopRecording = useCallback(() => {
        if (!holdingRef.current) return
        holdingRef.current = false
        setIsRecording(false)

        processorRef.current?.disconnect()
        processorRef.current = null
        audioCtxRef.current?.close().catch(() => {})
        audioCtxRef.current = null
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null

        doubaoRef.current?.endAudio()
        addLog('system', '录音结束，等待回复...')
    }, [addLog])

    // 打断
    const interruptPlayback = useCallback(() => {
        doubaoRef.current?.interrupt()
        addLog('system', '已打断播放')
    }, [addLog])

    // 空格键控制
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.code !== 'Space' || e.repeat || !connected) return
            e.preventDefault()
            startRecording()
        }
        const up = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return
            e.preventDefault()
            stopRecording()
        }
        window.addEventListener('keydown', down)
        window.addEventListener('keyup', up)
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    }, [connected, startRecording, stopRecording])

    const stateLabel: Record<RealtimeState, string> = {
        disconnected: '未连接',
        connecting: '连接中...',
        idle: '空闲',
        listening: '听你说...',
        thinking: '思考中...',
        speaking: '回复中...',
    }

    const stateColor: Record<RealtimeState, string> = {
        disconnected: '#888',
        connecting: '#f0ad4e',
        idle: '#5cb85c',
        listening: '#d9534f',
        thinking: '#f0ad4e',
        speaking: '#5bc0de',
    }

    const logColor: Record<LogEntry['type'], string> = {
        system: '#888',
        asr: '#5cb85c',
        chat: '#5bc0de',
        tts: '#d4a5ff',
        error: '#d9534f',
    }

    return (
        <div style={pageStyle}>
            <BackButton />

            {/* Header */}
            <div style={headerStyle}>
                <h2 style={{ margin: 0, fontSize: fontSize.lg, color: colors.text.primary }}>豆包端到端语音 Demo</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: stateColor[state] }} />
                    <span style={{ fontSize: fontSize.sm, color: stateColor[state] }}>{stateLabel[state]}</span>
                </div>
            </div>

            {/* Controls */}
            <div style={controlsStyle}>
                {!connected ? (
                    <button style={btnStyle} onClick={connect} disabled={state === 'connecting'}>
                        {state === 'connecting' ? '连接中...' : '连接'}
                    </button>
                ) : (
                    <>
                        <button style={btnStyle} onClick={disconnect}>断开</button>
                        <button
                            style={{ ...btnStyle, ...(isRecording ? btnRecordingStyle : {}) }}
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                        >
                            {isRecording ? '松开结束' : '按住说话'}
                        </button>
                        <button style={btnStyle} onClick={interruptPlayback} disabled={state !== 'speaking'}>
                            打断
                        </button>
                    </>
                )}
            </div>

            {/* ASR + Chat result */}
            {connected && (
                <div style={resultStyle}>
                    {asrText && (
                        <div style={resultRowStyle}>
                            <span style={{ color: '#5cb85c', fontWeight: fontWeight.bold, marginRight: spacing.xs }}>ASR:</span>
                            <span style={{ color: colors.text.primary }}>{asrText}</span>
                        </div>
                    )}
                    {chatText && (
                        <div style={resultRowStyle}>
                            <span style={{ color: '#5bc0de', fontWeight: fontWeight.bold, marginRight: spacing.xs }}>回复:</span>
                            <span style={{ color: colors.text.primary }}>{chatText}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Tip */}
            {connected && (
                <p style={{ fontSize: fontSize.xs, color: colors.text.muted, textAlign: 'center', margin: `${spacing.xs} 0` }}>
                    按住空格键或按钮说话，松开等待回复
                </p>
            )}

            {/* Logs */}
            <div style={logsStyle}>
                {logs.map((log, i) => (
                    <div key={i} style={{ fontSize: '12px', lineHeight: 1.5, fontFamily: 'monospace' }}>
                        <span style={{ color: '#666' }}>{log.time}</span>{' '}
                        <span style={{ color: logColor[log.type] }}>[{log.type}]</span>{' '}
                        <span style={{ color: colors.text.primary }}>{log.text}</span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
        </div>
    )
}

// ─── Styles ───

const pageStyle: React.CSSProperties = {
    width: '100vw', height: '100vh',
    display: 'flex', flexDirection: 'column',
    background: colors.bg.base, color: colors.text.primary,
    padding: spacing.md, boxSizing: 'border-box',
    overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, paddingTop: spacing.lg,
}

const controlsStyle: React.CSSProperties = {
    display: 'flex', gap: spacing.sm, marginBottom: spacing.md,
    justifyContent: 'center',
}

const btnStyle: React.CSSProperties = {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: radius.md, border: 'none',
    background: colors.brand.main, color: '#fff',
    fontSize: fontSize.sm, fontWeight: fontWeight.bold,
    cursor: 'pointer',
    minWidth: 80,
}

const btnRecordingStyle: React.CSSProperties = {
    background: '#d9534f',
}

const resultStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 60,
}

const resultRowStyle: React.CSSProperties = {
    marginBottom: spacing.xs,
    fontSize: fontSize.sm,
    lineHeight: 1.6,
}

const logsStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    padding: spacing.sm,
}
