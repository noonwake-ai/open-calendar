import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { paths } from '../router/urls'
import { callApi, getAppConfig } from '../utils/api'
import { apis } from '../utils/api'
import { getDeviceToken, setDeviceToken } from '../utils/device'
import { startBaziPolling } from '../utils/bazi-store'
import { fetchUserInfo } from '../utils/user-store'
import { colors, fontSize, fontWeight, radius, spacing, btn } from '../styles/tokens'

const QR_SESSION_TTL = 180 // 3 minutes, match backend
const POLL_INTERVAL = 2000

type ViewMode = 'loading' | 'qr' | 'phone'

export default function Pairing(): ReactElement {
    const navigate = useNavigate()
    const [mode, setMode] = useState<ViewMode>('loading')
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [remainingSeconds, setRemainingSeconds] = useState(QR_SESSION_TTL)
    const pollTimerRef = useRef<number | null>(null)
    const countdownTimerRef = useRef<number | null>(null)
    const startingRef = useRef(false)

    // 手机号登录状态
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [codeSent, setCodeSent] = useState(false)
    const [sending, setSending] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [countdown, setCountdown] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
        }
        if (countdownTimerRef.current) {
            window.clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
        }
    }, [])

    const startQrSession = useCallback(async () => {
        if (startingRef.current) return
        startingRef.current = true
        stopPolling()
        try {
            const resp = await callApi(apis.pi.auth.createSession, undefined as any)
            setSessionId(resp.session_id)
            setRemainingSeconds(QR_SESSION_TTL)
            setMode('qr')

            // 倒计时：只负责计数，归零停止
            countdownTimerRef.current = window.setInterval(() => {
                setRemainingSeconds(prev => Math.max(0, prev - 1))
            }, 1000)

            // 轮询
            pollTimerRef.current = window.setInterval(async () => {
                try {
                    const result = await callApi(apis.pi.auth.pollSession, { session_id: resp.session_id })
                    if (result.status === 'confirmed' && result.token) {
                        stopPolling()
                        setDeviceToken(result.token)
                        startBaziPolling()
                        fetchUserInfo()
                        navigate(paths.home.index)
                    } else if (result.status === 'expired') {
                        stopPolling()
                        setRemainingSeconds(0)
                    }
                } catch {
                    // 轮询失败静默重试
                }
            }, POLL_INTERVAL)
        } catch (e) {
            console.error('创建二维码 session 失败', e)
            setMode('phone')
        } finally {
            startingRef.current = false
        }
    }, [navigate, stopPolling])

    // 倒计时归零时自动刷新 session
    useEffect(() => {
        if (remainingSeconds === 0 && mode === 'qr') {
            void startQrSession()
        }
    }, [remainingSeconds, mode, startQrSession])

    // 初始化
    useEffect(() => {
        if (getDeviceToken()) {
            navigate(paths.home.index)
            return
        }

        ;(async () => {
            // 先检查 config.json 预置 token（demo 兼容）
            try {
                const config = await getAppConfig()
                if (config.DEVICE_TOKEN) {
                    setDeviceToken(config.DEVICE_TOKEN)
                    startBaziPolling()
                    fetchUserInfo()
                    navigate(paths.home.index)
                    return
                }
            } catch {}

            // 启动二维码 session
            await startQrSession()
        })()

        return () => stopPolling()
    }, [])

    // 手机号验证码倒计时
    useEffect(() => {
        if (countdown <= 0) return
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [countdown])

    const handleSendCode = async () => {
        if (!phone || phone.length < 11) {
            setError('请输入正确的手机号')
            return
        }
        setError(null)
        setSending(true)
        try {
            await callApi(apis.mina.user.sendPhoneVerifyCode, { phone })
            setCodeSent(true)
            setCountdown(60)
        } catch (e: any) {
            setError(e.msg ?? e.message ?? '发送失败')
        } finally {
            setSending(false)
        }
    }

    const handleVerify = async () => {
        if (!code || code.length < 4) {
            setError('请输入验证码')
            return
        }
        setError(null)
        setVerifying(true)
        try {
            const result = await callApi(apis.mina.user.verifyPhoneVerifyCode, { phone, verifyCode: code })
            setDeviceToken(result.token)
            startBaziPolling()
            fetchUserInfo()
            navigate(paths.home.index)
        } catch (e: any) {
            setError(e.msg ?? e.message ?? '验证失败')
        } finally {
            setVerifying(false)
        }
    }

    const qrValue = sessionId ? `allspirit://pi-login?session=${sessionId}` : ''
    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds % 60

    return (
        <div style={pageStyle}>
            <div style={logoStyle}>
                <svg width="120" height="120" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M240 166.219C240 194.437 218.314 214.019 209.625 235.746C200.935 257.474 205.242 283.547 209.625 305.274C214.008 327.002 200.814 348.728 166.074 340.038C83.5811 319.402 63.5913 231.401 74.9014 174.91C83.601 131.457 125.283 88 166.076 88C206.868 88 240 118.418 240 166.219Z" fill="url(#pi_logo_g1)" />
                    <path d="M272 345.781C272 317.563 293.686 297.981 302.375 276.254C311.065 254.526 306.758 228.453 302.375 206.726C297.992 184.998 311.186 163.272 345.926 171.962C428.419 192.598 448.409 280.599 437.099 337.09C428.399 380.543 386.717 424 345.924 424C305.132 424 272 393.582 272 345.781Z" fill="url(#pi_logo_g2)" />
                    <defs>
                        <linearGradient id="pi_logo_g1" x1="156" y1="342" x2="156" y2="88" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#786C8F" />
                            <stop offset="1" stopColor="#F6F1FF" />
                        </linearGradient>
                        <linearGradient id="pi_logo_g2" x1="356" y1="170" x2="356" y2="424" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#786C8F" />
                            <stop offset="1" stopColor="#F6F1FF" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            <h1 style={titleStyle}>万象有灵</h1>

            {mode === 'loading' && (
                <p style={{ color: colors.text.muted, fontSize: fontSize.base }}>连接中...</p>
            )}

            {mode === 'qr' && (
                <div style={qrContainerStyle}>
                    <div style={qrCardStyle}>
                        <QRCodeSVG
                            value={qrValue}
                            size={200}
                            bgColor="#ffffff"
                            fgColor="#1a1a2e"
                            level="M"
                        />
                    </div>
                    <p style={qrHintStyle}>打开『万象有灵』APP 扫码登录</p>
                    <p style={qrTimerStyle}>
                        {remainingSeconds > 0
                            ? `${minutes}:${seconds.toString().padStart(2, '0')} 后刷新`
                            : '正在刷新...'}
                    </p>
                    <button
                        onClick={() => { stopPolling(); setMode('phone') }}
                        style={switchBtnStyle}
                    >
                        手机号登录
                    </button>
                </div>
            )}

            {mode === 'phone' && (
                <div style={formStyle}>
                    <input
                        type="tel"
                        placeholder="输入手机号"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setCodeSent(false) }}
                        maxLength={11}
                        style={inputStyle}
                        autoFocus
                    />
                    <div style={codeRowStyle}>
                        <input
                            type="tel"
                            placeholder="输入验证码"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            maxLength={12}
                            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        />
                        <button
                            onClick={() => { if (countdown <= 0) handleSendCode() }}
                            disabled={sending || countdown > 0 || !phone || phone.length < 11}
                            style={{ ...btn.secondary, ...sendCodeBtnStyle, opacity: (sending || countdown > 0 || !phone || phone.length < 11) ? 0.4 : 0.8 }}
                        >
                            {sending ? '发送中...' : countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '获取验证码'}
                        </button>
                    </div>
                    <button
                        onClick={handleVerify}
                        disabled={verifying || !phone || phone.length < 11 || !code}
                        style={{ ...btn.primary, ...loginBtnStyle, opacity: (verifying || !phone || phone.length < 11 || !code) ? 0.4 : 1 }}
                    >
                        {verifying ? '验证中...' : '登录'}
                    </button>

                    {error && (
                        <p style={{ color: colors.fortune.bad, fontSize: fontSize.base, marginTop: `${spacing.md}px`, textAlign: 'center' }}>
                            {error}
                        </p>
                    )}

                    <button
                        onClick={() => { setMode('loading'); startQrSession() }}
                        style={switchBtnStyle}
                    >
                        返回扫码登录
                    </button>
                </div>
            )}
        </div>
    )
}

const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'start',
    minHeight: '100vh',
    padding: `${spacing.xxxl}px`,
    paddingBottom: '80px',
}

const logoStyle: React.CSSProperties = {
    display: 'none',
}

const titleStyle: React.CSSProperties = {
    fontSize: '46px',
    margin: `0`,
    fontWeight: fontWeight.bold,
    fontFamily: "'Source Han Serif SC', 'Noto Serif SC', 'STSong', Georgia, serif",
    color: colors.text.primary,
}

const qrContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
}

const qrCardStyle: React.CSSProperties = {
    padding: '20px',
    borderRadius: radius.lg,
    background: '#ffffff',
    margin: `${spacing.xl}px 0`,
}


const qrHintStyle: React.CSSProperties = {
    marginTop: `0`,
    fontSize: fontSize.md,
    color: colors.text.primary,
}

const qrTimerStyle: React.CSSProperties = {
    margin: `0`,
    fontSize: fontSize.sm,
    color: colors.text.muted,
}

const switchBtnStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '40px',
    background: 'none',
    border: 'none',
    color: colors.brand.light,
    fontSize: fontSize.sm,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
}

const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '420px',
    marginTop: `${spacing.xxxl}px`,
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `16px 24px`,
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.md,
    color: colors.text.primary,
    fontSize: '18px',
    textAlign: 'left',
    outline: 'none',
    marginBottom: `${spacing.md}px`,
    letterSpacing: '2px',
}

const codeRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: `${spacing.sm}px`,
    width: '100%',
    marginBottom: `${spacing.md}px`,
}

const sendCodeBtnStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '120px',
    padding: `16px ${spacing.sm}px`,
    fontSize: fontSize.sm,
    whiteSpace: 'nowrap',
}

const loginBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: `16px ${spacing.md}px`,
    marginTop: `${spacing.md}px`,
    marginBottom: `${spacing.sm}px`,
    fontSize: fontSize.md,
}
