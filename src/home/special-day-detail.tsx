import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { paths } from '../router/urls'
import { colors, fontSize, fontWeight, radius, spacing, whiteAlpha } from '../styles/tokens'
import { SolarDay } from 'tyme4ts'
import { sendProjectionMessage } from '../utils/projection-channel'
import { getBaziInfoStr, getCurrentTimeWuxing } from '../utils/bazi-store'
import { TTSPlayer } from '../utils/volcan-tts'
import { cleanLLMResponse } from '../common/utils'
import { getReportCache, saveReportCache } from '../utils/local-db'
import { getUserId } from '../utils/user-store'
import { DoubaoRealtimeChat, type SpecialDayChatInputs } from '../utils/doubao-realtime'
import dify from '../utils/dify'
import { getAppConfig } from '../utils/api'
import BackButton from '../components/back-button'
import PrintSignCard from '../components/print-sign-card'
import { GanInfo, WuXing2Name, WuXing, ZhiInfo } from '../common/utils/bazi'
import { publicAssetUrl } from '../utils/public-asset-url'
import printer from '../utils/printer'

interface SpecialDayState {
    title: string
    emotion?: string
    keywords?: string
    interpretation: string
    ganzhi?: string
    dayGanzhi?: string
    category?: 'solar' | 'ganRelation' | 'tenGodBranch'
    relation?: string
    term?: string
    modernName?: string
    todayGan?: string
    todayZhi?: string
    userGan?: string
    ganShiShen?: string
    zhiShiShen?: string
}

const PLACEHOLDER_INTERPRETATION = '此日天干地支交汇，能量场格外活跃，适合主动出击、展示成果。凡事起于今日，往往能得到超出预期的回应。行动力是今天最大的助力，犹豫反而会错失良机。建议在上午处理重要事项，将积攒已久的计划落地执行。'

const TTS_VOICE_TYPE = 'zh_female_xiaohe_uranus_bigtts'
const TENGOD_NAME = '食神'
const TENGOD_PERSONA = ''
const TENGOD_ACCENT = ''

interface SpecialDayReportData {
    reading: string
    inscription: [string, string]
    meaning: string
}

// 与 APP constants.ts Wuxing2Color 保持一致
const Wuxing2Color: Record<WuXing, string> = {
    [WuXing.Wood]:  '#99DB57',
    [WuXing.Fire]:  '#F95151',
    [WuXing.Earth]: '#DB8A43',
    [WuXing.Metal]: '#FFD83B',
    [WuXing.Water]: '#66D0FE',
}

const solarBannerMap: Record<string, string> = {
    立春: publicAssetUrl('solar-banner/lichun.png'), 雨水: publicAssetUrl('solar-banner/yushui.png'),
    惊蛰: publicAssetUrl('solar-banner/jingzhe.png'), 春分: publicAssetUrl('solar-banner/chunfen.png'),
    清明: publicAssetUrl('solar-banner/qingming.png'), 谷雨: publicAssetUrl('solar-banner/guyu.png'),
    立夏: publicAssetUrl('solar-banner/lixia.png'), 小满: publicAssetUrl('solar-banner/xiaoman.png'),
    芒种: publicAssetUrl('solar-banner/mangzhong.png'), 夏至: publicAssetUrl('solar-banner/xiazhi.png'),
    小暑: publicAssetUrl('solar-banner/xiaoshu.png'), 大暑: publicAssetUrl('solar-banner/dashu.png'),
    立秋: publicAssetUrl('solar-banner/liqiu.png'), 处暑: publicAssetUrl('solar-banner/chushu.png'),
    白露: publicAssetUrl('solar-banner/bailu.png'), 秋分: publicAssetUrl('solar-banner/qiufen.png'),
    寒露: publicAssetUrl('solar-banner/hanlu.png'), 霜降: publicAssetUrl('solar-banner/shuangjiang.png'),
    立冬: publicAssetUrl('solar-banner/lidong.png'), 小雪: publicAssetUrl('solar-banner/xiaoxue.png'),
    大雪: publicAssetUrl('solar-banner/daxue.png'), 冬至: publicAssetUrl('solar-banner/dongzhi.png'),
    小寒: publicAssetUrl('solar-banner/xiaohan.png'), 大寒: publicAssetUrl('solar-banner/dahan.png'),
}

const riZhuMap: Record<string, string> = {
    甲: publicAssetUrl('ri-zhu/jiamu.png'), 乙: publicAssetUrl('ri-zhu/yimu.png'),
    丙: publicAssetUrl('ri-zhu/binghuo.png'), 丁: publicAssetUrl('ri-zhu/dinghuo.png'),
    戊: publicAssetUrl('ri-zhu/wutu.png'), 己: publicAssetUrl('ri-zhu/jitu.png'),
    庚: publicAssetUrl('ri-zhu/gengjin.png'), 辛: publicAssetUrl('ri-zhu/xinjin.png'),
    壬: publicAssetUrl('ri-zhu/renshui.png'), 癸: publicAssetUrl('ri-zhu/guishui.png'),
}

const tenGodImgMap: Record<string, string> = {
    比肩: publicAssetUrl('ten-god/bijian.png'), 劫财: publicAssetUrl('ten-god/jiecai.png'),
    食神: publicAssetUrl('ten-god/shishen.png'), 伤官: publicAssetUrl('ten-god/shangguan.png'),
    偏财: publicAssetUrl('ten-god/piancai.png'), 正财: publicAssetUrl('ten-god/zhengcai.png'),
    七杀: publicAssetUrl('ten-god/qisha.png'), 正官: publicAssetUrl('ten-god/zhengguan.png'),
    偏印: publicAssetUrl('ten-god/pianyin.png'), 正印: publicAssetUrl('ten-god/zhengyin.png'),
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

function getDefaultInscription(title: string): [string, string] {
    if (title.length >= 4) return [title.slice(0, 4), '万象有灵']
    return ['特殊之日', '万象有灵']
}

/* ─── OriginBadge: 来历可视化 ─── */

function GlassRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <div style={{ ...glassRowStyle, ...style }}>{children}</div>
}

function ArrowIcon({ flipped }: { flipped?: boolean }) {
    return (
        <svg viewBox="0 0 34 64" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ width: 24, height: 44, transform: flipped ? 'scaleX(-1)' : undefined, flexShrink: 0 }}>
            <path d="M0.265137 12L32.2651 32L0.265137 52" stroke="white" strokeOpacity="0.2" />
        </svg>
    )
}

function OriginBadge({ category, term, todayGan, todayZhi, userGan, ganShiShen, zhiShiShen }: {
    category?: string; term?: string; todayGan?: string; todayZhi?: string
    userGan?: string; ganShiShen?: string; zhiShiShen?: string
}) {
    if (!category) return null

    if (category === 'solar' && term) {
        const bannerSrc = solarBannerMap[term]
        return (
            <div style={originWrapStyle}>
                {bannerSrc && <img src={bannerSrc} alt={term}
                    style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: radius.md }} />}
            </div>
        )
    }

    if (category === 'ganRelation' && todayGan && userGan) {
        const todayWuXingName = WuXing2Name[GanInfo[todayGan]?.wuxing] ?? ''
        const userWuXingName = WuXing2Name[GanInfo[userGan]?.wuxing] ?? ''
        return (
            <div style={originWrapStyle}>
                <GlassRow style={{ justifyContent: 'center', gap: '24px' }}>
                    <div style={ganColStyle}>
                        <span style={{ ...ganNameStyle, color: colors.brand.light }}>{todayGan}{todayWuXingName}</span>
                        <span style={ganSubLabelStyle}>今日天干</span>
                    </div>
                    <img src={riZhuMap[todayGan]} alt={todayGan}
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={xSymbolStyle}>X</span>
                    <img src={riZhuMap[userGan]} alt={userGan}
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={ganColStyle}>
                        <span style={{ ...ganNameStyle, color: colors.brand.light }}>{userGan}{userWuXingName}</span>
                        <span style={ganSubLabelStyle}>你的五行</span>
                    </div>
                </GlassRow>
            </div>
        )
    }

    if (category === 'tenGodBranch' && todayGan && todayZhi && userGan) {
        const ganColor = Wuxing2Color[GanInfo[todayGan]?.wuxing] ?? colors.brand.light
        const zhiColor = Wuxing2Color[ZhiInfo[todayZhi]?.wuxing] ?? colors.brand.light
        const userColor = Wuxing2Color[GanInfo[userGan]?.wuxing] ?? colors.brand.light
        const userWuXingName = WuXing2Name[GanInfo[userGan]?.wuxing] ?? ''
        return (
            <div style={originWrapStyle}>
                <GlassRow style={{ justifyContent: 'space-evenly', alignItems: 'flex-start', gap: '0', paddingTop: '12px', height: '114px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={tenGodLabelStyle}>今日</span>
                        <div style={{ ...ganZhiDotStyle, background: `${ganColor}22`, marginTop: 10 }}>
                            <span style={{ fontSize: '13px', color: ganColor, lineHeight: 1 }}>{todayGan}</span>
                        </div>
                        <div style={{ ...ganZhiDotStyle, background: `${zhiColor}22`, marginTop: 8 }}>
                            <span style={{ fontSize: '13px', color: zhiColor, lineHeight: 1 }}>{todayZhi}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 36 }}><ArrowIcon /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={tenGodLabelStyle}>你的五行</span>
                        <div style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', marginTop: 8 }}>
                            <img src={riZhuMap[userGan]} alt={userGan}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(19,19,20,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '12px', color: userColor, lineHeight: 1.3, fontWeight: fontWeight.semibold }}>{userGan}</span>
                                <span style={{ fontSize: '12px', color: userColor, lineHeight: 1.3, fontWeight: fontWeight.semibold }}>{userWuXingName}</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 36 }}><ArrowIcon flipped /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={tenGodLabelStyle}>十神</span>
                        {ganShiShen && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                                {tenGodImgMap[ganShiShen] && <img src={tenGodImgMap[ganShiShen]} alt={ganShiShen}
                                    style={{ width: 24, height: 24, borderRadius: '50%' }} />}
                                <span style={{ fontSize: '13px', color: colors.text.primary }}>{ganShiShen}</span>
                            </div>
                        )}
                        {zhiShiShen && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                                {tenGodImgMap[zhiShiShen] && <img src={tenGodImgMap[zhiShiShen]} alt={zhiShiShen}
                                    style={{ width: 24, height: 24, borderRadius: '50%' }} />}
                                <span style={{ fontSize: '13px', color: colors.text.primary }}>{zhiShiShen}</span>
                            </div>
                        )}
                    </div>
                </GlassRow>
            </div>
        )
    }
    return null
}

/* ─── Voice Bar ─── */

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
            processorRef.current = null; streamRef.current = null; ctxRef.current = null
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

/* ─── Main Page ─── */

export default function SpecialDayDetail(): ReactElement {
    const location = useLocation()
    const state = location.state as SpecialDayState | null

    const title = state?.title ?? '特殊日'
    const category = state?.category ?? ''
    const emotion = state?.emotion
    const keywords = state?.keywords
    const interpretation = state?.interpretation ?? PLACEHOLDER_INTERPRETATION
    // Reason: index.tsx 传的是 dayGanzhi，兼容两个字段名
    const ganzhiDate = state?.dayGanzhi || state?.ganzhi || getGanzhiDate()
    const accentColor = colors.fortune.special

    const displayName = (() => {
        if (state?.category === 'solar' && state.term) {
            return state.modernName ? `${state.term}·${state.modernName}` : state.term
        }
        if (state?.relation) return state.relation
        return ganzhiDate
    })()

    const [loading, setLoading] = useState(true)
    const [reportData, setReportData] = useState<SpecialDayReportData | null>(null)
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

    // Reason: 加载或生成特殊日报告
    useEffect(() => {
        let cancelled = false
        async function loadOrFetch() {
            const config = await getAppConfig()
            const cached = await getReportCache<SpecialDayReportData>('specialday', title)
            if (cached && !cancelled) { setReportData(cached); setLoading(false); return }

            const specialDayInfo = JSON.stringify({ title, category, emotion: emotion ?? '', keywords: keywords ?? '', interpretation })
            try {
                const result = await dify.completionMessages(
                    { apiKey: config.DIFY?.SPECIAL_DAY_REPORT_KEY ?? '', baseUrl: config.DIFY?.BASE_URL ?? '' }, {
                    inputs: {
                        special_day_category: category,
                        special_day_info: specialDayInfo,
                        today_date: getCurrentTimeWuxing(),
                        user_bazi: getBaziInfoStr(),
                        shishen: TENGOD_NAME,
                        shishen_persona: TENGOD_PERSONA,
                        shishen_accent: TENGOD_ACCENT,
                    },
                    user: getUserId(), files: [], response_mode: 'blocking',
                })
                if (cancelled) return
                const jsonStr = cleanLLMResponse((result.answer ?? '').trim())
                if (!jsonStr) throw new Error('Dify 返回为空')
                const data = JSON.parse(jsonStr) as SpecialDayReportData
                setReportData(data)
                await saveReportCache('specialday', title, data)
                const ttsPlayer = new TTSPlayer(TTS_VOICE_TYPE, (playing) => {
                    sendProjectionMessage({ type: 'trigger_scene', scene: playing ? 'interpret' : 'idle' })
                })
                ttsPlayerRef.current = ttsPlayer
                ttsPlayer.feed(data.reading); ttsPlayer.flush()
            } catch (e) {
                console.error('特殊日报告生成失败，使用规则数据:', e)
                if (!cancelled) sendProjectionMessage({ type: 'trigger_scene', scene: 'interpret', tts_content: interpretation })
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadOrFetch()
        return () => { cancelled = true }
    }, [title, category, emotion, keywords, interpretation])

    // Reason: 报告生成完成后初始化豆包端到端语音会话
    useEffect(() => {
        if (loading || !reportData) return

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

        const inputs: SpecialDayChatInputs = {
            scene: 'specialday',
            specialDayCategory: category,
            specialDayInfo: JSON.stringify({ title, category, emotion, keywords, interpretation }),
            reportReading: reportData.reading,
            reportInscription: reportData.inscription.join(''),
            reportMeaning: reportData.meaning,
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
                console.error('[SpecialDay Doubao] Session init failed:', e)
            })

        return () => {
            doubao.close()
            if (doubaoRef.current === doubao) doubaoRef.current = null
            setDoubaoReady(false)
        }
    }, [loading, reportData, title, category, emotion, keywords, interpretation])

    // 豆包端到端音频回调
    const handleDoubaoAudio = useCallback((pcm: ArrayBuffer) => {
        doubaoRef.current?.sendAudio(pcm)
    }, [])

    const handleDoubaoRecordStop = useCallback(() => {
        doubaoRef.current?.endAudio()
    }, [])

    const displayContent = reportData?.reading ?? interpretation
    const [signLine1, signLine2] = reportData ? reportData.inscription : getDefaultInscription(title)

    return (
        <div style={pageStyle}>
            <BackButton to={paths.home.index} />

            <div style={leftPanelStyle}>
                <div style={{ flex: 1, overflow: 'auto' }}>
                    <h1 style={{ ...titleStyle, color: accentColor }}>{title}</h1>
                    <p style={ganzhiStyle}>{displayName}</p>

                    <div style={tagsRowStyle}>
                        {emotion && <span style={{ ...tagStyle, borderColor: `${accentColor}44`, color: accentColor }}>{emotion}</span>}
                        {keywords && keywords.split(/[,，、]/).filter(Boolean).map((kw, i) => (
                            <span key={i} style={{ ...tagStyle, borderColor: `${accentColor}44`, color: accentColor }}>{kw.trim()}</span>
                        ))}
                    </div>

                    <OriginBadge category={state?.category} term={state?.term}
                        todayGan={state?.todayGan} todayZhi={state?.todayZhi} userGan={state?.userGan}
                        ganShiShen={state?.ganShiShen} zhiShiShen={state?.zhiShiShen} />

                    {loading ? (
                        <p style={{ color: colors.text.muted, fontSize: fontSize.md }}>正在生成特殊日解读...</p>
                    ) : (
                        <>
                            {reportData && <p style={meaningStyle}>{reportData.meaning}</p>}
                            <p style={contentStyle}>{displayContent}</p>
                        </>
                    )}
                </div>

                {!loading && reportData && doubaoReady && (
                    <VoiceBar onRecordStart={interrupt} onAudioData={handleDoubaoAudio} onRecordStop={handleDoubaoRecordStop} />
                )}
            </div>

            <div style={rightPanelStyle}>
                {!loading && (
                    <PrintSignCard topText={ganzhiDate} line1={signLine1} line2={signLine2}
                        bottomText={title} accentColor={accentColor} buttonLabel="打印签文"
                        onPrint={() => printer.print(signLine1, signLine2)} />
                )}
            </div>
        </div>
    )
}

/* ─── Styles ─── */

const pageStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'row', height: '100vh',
    padding: `${spacing.xl}px 80px`, gap: `${spacing.xl}px`, overflow: 'hidden', position: 'relative',
}
const leftPanelStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: `${spacing.md}px`, minWidth: 0 }
const rightPanelStyle: React.CSSProperties = {
    width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: `${spacing.lg}px`,
}
const titleStyle: React.CSSProperties = { fontSize: fontSize.xxl, fontWeight: fontWeight.semibold, margin: 0, letterSpacing: '2px' }
const ganzhiStyle: React.CSSProperties = { fontSize: fontSize.base, color: colors.text.muted, margin: `${spacing.xs}px 0 ${spacing.md}px`, letterSpacing: '1px' }
const tagsRowStyle: React.CSSProperties = { display: 'flex', gap: `${spacing.xs}px`, marginBottom: `${spacing.lg}px`, flexWrap: 'wrap' }
const tagStyle: React.CSSProperties = { padding: `4px ${spacing.sm}px`, border: '1px solid', borderRadius: radius.full, fontSize: fontSize.sm, letterSpacing: '0.5px' }
const originWrapStyle: React.CSSProperties = { marginBottom: `${spacing.lg}px` }
const glassRowStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'row', alignItems: 'center', background: whiteAlpha(0.06),
    backdropFilter: 'blur(12px)', border: `1px solid ${whiteAlpha(0.1)}`,
    borderRadius: radius.md, padding: `${spacing.sm}px ${spacing.md}px`, height: '96px', boxSizing: 'border-box',
}
const ganColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }
const ganNameStyle: React.CSSProperties = { fontSize: fontSize.md, fontWeight: fontWeight.bold }
const ganSubLabelStyle: React.CSSProperties = { fontSize: fontSize.xs, color: colors.brand.gray }
const xSymbolStyle: React.CSSProperties = { fontSize: '24px', color: whiteAlpha(0.5), lineHeight: 1 }
const tenGodLabelStyle: React.CSSProperties = { fontSize: fontSize.xs, color: whiteAlpha(0.5) }
const ganZhiDotStyle: React.CSSProperties = { width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const contentStyle: React.CSSProperties = { fontSize: fontSize.md, color: colors.text.secondary, lineHeight: 1.8, margin: 0 }
const meaningStyle: React.CSSProperties = {
    fontSize: fontSize.base, color: colors.text.muted, fontStyle: 'italic',
    margin: `0 0 ${spacing.md}px`, letterSpacing: '0.5px',
}
const voiceBarStyle: React.CSSProperties = {
    padding: `${spacing.sm}px`, background: 'rgba(116,65,255,0.06)',
    border: `1px solid ${colors.brand.border}`, borderRadius: radius.lg, textAlign: 'center',
}
const voiceLabelStyle: React.CSSProperties = { fontSize: fontSize.xs, color: colors.text.muted, letterSpacing: '1px' }
