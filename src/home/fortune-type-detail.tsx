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
import ReadingLoading from '../components/reading-loading'
import ResultVoiceBar from '../components/result-voice-bar'
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
                <div className="hide-scrollbar" style={scrollAreaStyle}>
                    <h1 style={{ ...titleStyle, color: accentColor }}>{label}</h1>
                    <p style={{ ...ganzhiStyle, color: withAlpha(accentColor, 0.4) }}>{ganzhiDate}</p>

                    {loading ? (
                        <ReadingLoading text="正在生成运势报告..." />
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
                {!loading && reportData && (
                    <div style={floatingVoiceStyle}>
                        <ResultVoiceBar
                            enabled={doubaoReady}
                            onRecordStart={interrupt}
                            onAudioData={handleDoubaoAudio}
                            onRecordStop={handleDoubaoRecordStop}
                        />
                    </div>
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

/* ─── Styles ─── */

const pageStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'row', height: '100vh',
    padding: `0 80px`, gap: `${spacing.xl}px`,
    overflow: 'hidden', position: 'relative',
}
const leftPanelStyle: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', gap: `${spacing.md}px`, minWidth: 0, position: 'relative', height: '100%', minHeight: 0,
}
const scrollAreaStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    minHeight: 0,
    paddingTop: `${spacing.xl}px`,
    paddingBottom: '176px',
}
const floatingVoiceStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: '24px',
    zIndex: 1,
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
    fontSize: fontSize.base, color: withAlpha(colors.text.primary, 0.62), fontStyle: 'italic',
    margin: `0 0 ${spacing.md}px`, letterSpacing: '0.5px',
}
const fortuneIndexStyle: React.CSSProperties = {
    fontSize: fontSize.xl, color: colors.brand.light, letterSpacing: '4px', marginBottom: `${spacing.md}px`,
}
const contentStyle: React.CSSProperties = {
    fontSize: fontSize.md, color: colors.text.primary, lineHeight: 1.8, margin: 0,
}
