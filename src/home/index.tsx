import React, { ReactElement, useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths, fortuneTypePath } from '../router/urls'
import { callApi } from '../utils/api'
import { apis } from '../utils/api'
import { getDeviceToken } from '../utils/device'
import { startBaziPolling, getActiveBazi, onBaziChange } from '../utils/bazi-store'
import baziHelpers from '../common/helpers/bazi-helpers'
import { fetchUserInfo, getUser } from '../utils/user-store'
import { Blessing, listAllBlessings } from '../utils/local-db'
import { colors, fontSize, fontWeight, radius, spacing, whiteAlpha, brandAlpha, withAlpha } from '../styles/tokens'
import { SolarDay } from 'tyme4ts'
import { INITIAL_TODOS, formatDateKey } from './todo-calendar'
import { buildTodoCategoryMap, TODO_CATEGORY_COLORS } from './todo-meta'
import { getAllFortuneViewedTags, saveFortuneViewedTags } from '../utils/fortune-viewed-store'
import { publicAssetUrl } from '../utils/public-asset-url'
import { reportPiEventConsumerLog } from '../utils/pi-event-bridge'
import { sendProjectionMessage } from '../utils/projection-channel' 

type HomeData = NonNullable<typeof apis.pi.home.today['_resp']>

// TODO: 替换为实际的屏保视频地址
const SCREENSAVER_VIDEO_URL = publicAssetUrl('pingbao.mp4')

const WEEKDAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const SOLAR_BANNER_MAP: Record<string, string> = {
    立春: publicAssetUrl('solar-card/lichun.png'), 雨水: publicAssetUrl('solar-card/yushui.png'),
    惊蛰: publicAssetUrl('solar-card/jingzhe.png'), 春分: publicAssetUrl('solar-card/chunfen.png'),
    清明: publicAssetUrl('solar-card/qingming.png'), 谷雨: publicAssetUrl('solar-card/guyu.png'),
    立夏: publicAssetUrl('solar-card/lixia.png'), 小满: publicAssetUrl('solar-card/xiaoman.png'),
    芒种: publicAssetUrl('solar-card/mangzhong.png'), 夏至: publicAssetUrl('solar-card/xiazhi.png'),
    小暑: publicAssetUrl('solar-card/xiaoshu.png'), 大暑: publicAssetUrl('solar-card/dashu.png'),
    立秋: publicAssetUrl('solar-card/liqiu.png'), 处暑: publicAssetUrl('solar-card/chushu.png'),
    白露: publicAssetUrl('solar-card/bailu.png'), 秋分: publicAssetUrl('solar-card/qiufen.png'),
    寒露: publicAssetUrl('solar-card/hanlu.png'), 霜降: publicAssetUrl('solar-card/shuangjiang.png'),
    立冬: publicAssetUrl('solar-card/lidong.png'), 小雪: publicAssetUrl('solar-card/xiaoxue.png'),
    大雪: publicAssetUrl('solar-card/daxue.png'), 冬至: publicAssetUrl('solar-card/dongzhi.png'),
    小寒: publicAssetUrl('solar-card/xiaohan.png'), 大寒: publicAssetUrl('solar-card/dahan.png'),
}

const TEN_GOD_BRANCH_IMG_MAP: Record<string, string> = {
    食神制杀: publicAssetUrl('ten-god-branch/shishenzhisha.png'),
    食伤生财: publicAssetUrl('ten-god-branch/shishangshengcai.png'),
    伤官见官: publicAssetUrl('ten-god-branch/shangguanjianguan.png'),
    伤官佩印: publicAssetUrl('ten-god-branch/shangguanpeiyin.png'),
    伤官配印: publicAssetUrl('ten-god-branch/shangguanpeiyin.png'),
    财生官杀: publicAssetUrl('ten-god-branch/caishengguansha.png'),
    劫财争财: publicAssetUrl('ten-god-branch/jiecaizhengcai.png'),
    官印相生: publicAssetUrl('ten-god-branch/guanyinxiangsheng.png'),
    官杀混杂: publicAssetUrl('ten-god-branch/guanshahunza.png'),
    偏印夺食: publicAssetUrl('ten-god-branch/pianyinduoshi.png'),
}

const GAN_RELATION_IMG_MAP: Record<string, string> = {
    甲己合: publicAssetUrl('gan-relation/jiaji.png'),
    乙庚合: publicAssetUrl('gan-relation/yigeng.png'),
    丙辛合: publicAssetUrl('gan-relation/bingxin.png'),
    丁壬合: publicAssetUrl('gan-relation/dingren.png'),
    戊癸合: publicAssetUrl('gan-relation/wugui.png'),
    甲庚冲: publicAssetUrl('gan-relation/jiageng.png'),
    乙辛冲: publicAssetUrl('gan-relation/yixin.png'),
    丙壬冲: publicAssetUrl('gan-relation/bingren.png'),
    丁癸冲: publicAssetUrl('gan-relation/dinggui.png'),
}

function getSpecialDayCardImg(sd: { category?: string; data: any }): string | null {
    if (sd.category === 'solar' && sd.data.term) return SOLAR_BANNER_MAP[sd.data.term] ?? null
    if (sd.category === 'tenGodBranch' && sd.data.relation) return TEN_GOD_BRANCH_IMG_MAP[sd.data.relation] ?? null
    if (sd.category === 'ganRelation' && sd.data.relation) return GAN_RELATION_IMG_MAP[sd.data.relation] ?? null
    return null
}

const FORTUNE_ITEMS = [
    { key: 'love',   icon: '♥', cnTitle: '桃花', color: TODO_CATEGORY_COLORS.love,   image: publicAssetUrl('fortune-love.png') },
    { key: 'career', icon: '❖', cnTitle: '事业', color: TODO_CATEGORY_COLORS.career, image: publicAssetUrl('fortune-career.png') },
    { key: 'wealth', icon: '¥', cnTitle: '财运', color: TODO_CATEGORY_COLORS.wealth, image: publicAssetUrl('fortune-wealth.png') },
    { key: 'study',  icon: '✎', cnTitle: '学业', color: TODO_CATEGORY_COLORS.study,  image: publicAssetUrl('fortune-study.png') },
] as const

// 扇形旋转角度：从负到正均匀分布
const FORTUNE_STACK_ROTATIONS = [-18, -6, 6, 18]
const FORTUNE_OVERLAY_ROTATIONS = [-15, -5, 5, 15]

function formatTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
}

function getGanzhiLines(ganzhiText: string): string[] {
    const normalized = ganzhiText.replace(/\s+/g, ' ').trim()
    if (!normalized) return []

    const structuredParts = normalized.match(/[^ ]+[年月日]/g)
    if (structuredParts?.length) return structuredParts.slice(0, 3)

    return normalized.split(' ').filter(Boolean).slice(0, 3)
}

function getLunarDayText(date: Date): string {
    try {
        const solar = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
        const lunar = solar.getLunarDay()
        return lunar.getName()
    } catch {
        return ''
    }
}

/** 生成本周 7 天（周日~周六）*/
function getWeekDays(today: Date): Date[] {
    const days: Date[] = []
    const current = new Date(today)
    current.setDate(today.getDate() - today.getDay())
    for (let i = 0; i < 7; i++) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
    }
    return days
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate()
}

function formatWeekDayNumber(date: Date): string {
    return `${date.getDate()}`
}

function formatMonthDay(dateKey: string): string {
    // dateKey: "YYYY-MM-DD" → "M月D日"
    const parts = dateKey.split('-')
    if (parts.length < 3) return dateKey
    return `${parseInt(parts[1])}月${parseInt(parts[2])}日`
}

// 模块级缓存：跨导航保持已唤醒状态；天干地支日期变化时重置
let _cachedAwakePhase: 'sleep' | 'awake' = 'sleep'
let _cachedAwakeDate = ''  // 格式：new Date().toDateString()
let _justWoke = false      // 仅首次唤醒动画播放，导航返回不重放

/** 供外部（如设置页）调用，将设备重置回未唤醒状态 */
export function resetToSleep(): void {
    _cachedAwakePhase = 'sleep'
    _cachedAwakeDate = ''
}

export default function CalendarHome(): ReactElement {
    const navigate = useNavigate()
    const [data, setData] = useState<HomeData | null>(null)
    const [loading, setLoading] = useState(true)
    const [now, setNow] = useState(new Date())
    const [blessings, setBlessings] = useState<Blessing[]>([])
    const [isFortuneOverlayOpen, setIsFortuneOverlayOpen] = useState(false)
    const [isSpecialDayOverlayOpen, setIsSpecialDayOverlayOpen] = useState(false)
    const [fortuneSourceRect, setFortuneSourceRect] = useState<DOMRect | null>(null)
    const [specialDaySourceRect, setSpecialDaySourceRect] = useState<DOMRect | null>(null)
    const [fortuneViewedTags, setFortuneViewedTags] = useState<Record<string, [string, string, string]>>(() => getAllFortuneViewedTags())
    const fortunePaneRef = useRef<HTMLDivElement>(null)
    const specialDayCardRef = useRef<HTMLDivElement>(null)
    const shakeNavigatedRef = useRef(false)
    // 'sleep' = 屏保中 | 'waking' = 正在唤醒动画 | 'awake' = 已唤醒
    const [awakePhase, setAwakePhase] = useState<'sleep' | 'waking' | 'awake'>(() => {
        if (_cachedAwakePhase === 'awake' && _cachedAwakeDate === new Date().toDateString()) return 'awake'
        _cachedAwakePhase = 'sleep'
        return 'sleep'
    })
    // Reason: 用于检测八字切换（非首次加载），只有 bazi_id 实际变化才回到未唤醒
    const prevBaziIdRef = useRef<string | null | undefined>(undefined)

    // 进入首页时右屏黑屏（若未唤醒；已唤醒时不重置）
    useEffect(() => {
        if (_cachedAwakePhase !== 'awake') {
            sendProjectionMessage({ type: 'trigger_scene', scene: 'sleep' })
        }
    }, [])

    // 物理唤醒按键 → 进入唤醒动画阶段（投影消息由 main.tsx 统一发送）
    useEffect(() => {
        const onWake = () => setAwakePhase(prev => prev === 'sleep' ? 'waking' : prev)
        window.addEventListener('pi:wake.trigger', onWake)
        return () => window.removeEventListener('pi:wake.trigger', onWake)
    }, [])

    // 八字切换时回到未唤醒状态
    useEffect(() => {
        return onBaziChange((bazi) => {
            const newId = bazi?.bazi_id ?? null
            const prevId = prevBaziIdRef.current
            prevBaziIdRef.current = newId
            // undefined = 首次加载，不触发重置；实际变化才重置
            if (prevId !== undefined && prevId !== newId) {
                _cachedAwakePhase = 'sleep'
                setAwakePhase('sleep')
                sendProjectionMessage({ type: 'trigger_scene', scene: 'sleep' })
            }
        })
    }, [])

    const handleOpenFortune = useCallback(() => {
        if (fortunePaneRef.current) setFortuneSourceRect(fortunePaneRef.current.getBoundingClientRect())
        setIsFortuneOverlayOpen(true)
    }, [])

    const handleOpenSpecialDay = useCallback(() => {
        if (specialDayCardRef.current) setSpecialDaySourceRect(specialDayCardRef.current.getBoundingClientRect())
        setIsSpecialDayOverlayOpen(true)
    }, [])

    // 加载完成后捕获 rect，确保第一次展开动画起点正确
    useEffect(() => {
        if (loading) return
        if (fortunePaneRef.current) setFortuneSourceRect(fortunePaneRef.current.getBoundingClientRect())
        if (specialDayCardRef.current) setSpecialDaySourceRect(specialDayCardRef.current.getBoundingClientRect())
    }, [loading])

    // 未登录跳转登录页
    useEffect(() => {
        if (!getDeviceToken()) {
            navigate(paths.login, { replace: true })
        } else {
            startBaziPolling()
            if (!getUser()) fetchUserInfo()
        }
    }, [navigate])

    // 加载赐福事项
    useEffect(() => {
        listAllBlessings().then(all => {
            const todayKey = formatDateKey(now)
            const dbItems = all.filter(b => b.date >= todayKey && !b.completed)
            const todoItems: Blessing[] = INITIAL_TODOS
                .filter(t => t.date >= todayKey && !t.completed)
                .map(t => ({
                    item: t.item,
                    reason: t.reason,
                    tag: t.tag,
                    date: t.date,
                    hexagramName: t.hexagramName,
                    question: t.question,
                    completed: t.completed,
                    createdAt: 0,
                }))
            setBlessings([...todoItems, ...dbItems])
        })
    }, [now])

    // 实时时钟
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        callApi(apis.pi.home.today, undefined as any)
            .then(setData)
            .catch(() => {
                const n = new Date()
                const weekDays = ['日', '一', '二', '三', '四', '五', '六']
                setData({
                    date: {
                        solar: `${n.getFullYear()}年${n.getMonth() + 1}月${n.getDate()}日 星期${weekDays[n.getDay()]}`,
                        lunar: '',
                        ganzhi: '',
                    },
                    tengod: null,
                    dailyFortune: null,
                    specialDays: [],
                    user: null,
                })
            })
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!isFortuneOverlayOpen && !isSpecialDayOverlayOpen) return

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFortuneOverlayOpen(false)
                setIsSpecialDayOverlayOpen(false)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [isFortuneOverlayOpen, isSpecialDayOverlayOpen])

    // Reason: 硬件摇杆触发 → 从首页导航至摇卦页面（ref 闸门防重复导航）
    useEffect(() => {
        shakeNavigatedRef.current = false
        const onShake = (event: Event) => {
            if (shakeNavigatedRef.current) return
            shakeNavigatedRef.current = true
            const detail = event instanceof CustomEvent ? event.detail : undefined
            reportPiEventConsumerLog('consumer:home', 'shake.navigate', detail)
            navigate(paths.home.shake)
        }
        window.addEventListener('pi:shake.trigger', onShake)
        return () => window.removeEventListener('pi:shake.trigger', onShake)
    }, [navigate])

    // 从详情页返回时刷新已查看状态
    useEffect(() => {
        const onFocus = () => setFortuneViewedTags(getAllFortuneViewedTags())
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [])

    // 唤醒入场动画仅首次唤醒播放，导航返回不重放
    useEffect(() => {
        _justWoke = false
    }, [])

    if (awakePhase === 'sleep') {
        return (
            <div style={sleepScreenStyle}>
                <video
                    src={SCREENSAVER_VIDEO_URL}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={screensaverVideoStyle}
                />
                <button
                    style={wakeButtonStyle}
                    onClick={() => window.dispatchEvent(new CustomEvent('pi:wake.trigger'))}
                >
                    唤醒
                </button>
            </div>
        )
    }

    if (awakePhase === 'waking') {
        return (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 100,
                    overflow: 'hidden',
                    animation: 'sleep-shrink 1500ms cubic-bezier(0.4, 0, 0.2, 1) both',
                }}
                onAnimationEnd={(e: React.AnimationEvent) => {
                    if (e.animationName === 'sleep-shrink') {
                        _justWoke = true
                        _cachedAwakePhase = 'awake'
                        _cachedAwakeDate = new Date().toDateString()
                        setAwakePhase('awake')
                    }
                }}
            >
                <video
                    src={SCREENSAVER_VIDEO_URL}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={screensaverVideoStyle}
                />
            </div>
        )
    }

    const weekDays = getWeekDays(now)
    const weekTodoCategoryMap = buildTodoCategoryMap(blessings)
    const specialDays = data?.specialDays ?? []
    const firstSpecialDay = specialDays[0] ?? null
    const ganzhiLines = getGanzhiLines(data?.date.ganzhi ?? '')
    const nearestBlessingDate = [...blessings]
        .sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? null
    const blessingDates = new Set(blessings.map(b => b.date))
    // 仅首次唤醒播放入场动画
    const slideIn = (delay: string) =>
        _justWoke ? `home-slide-in 700ms ${delay} cubic-bezier(0.22,1,0.36,1) both` : 'none'

    return (
        <>
        {loading ? (
            <div style={loadingStyle}>
                <p style={{ color: colors.text.muted, fontSize: fontSize.md }}>加载中...</p>
            </div>
        ) : (
        <div style={pageStyle}>
            {/* ── 区域 A：顶部栏（时钟 + 干支） ── */}
            <header style={{ ...headerStyle, animation: slideIn('0ms') }}>
                <div style={headerMainStyle}>
                    <div style={clockStyle}>{formatTime(now)}</div>
                    {ganzhiLines.length > 0 && (
                        <div style={ganzhiBlockStyle}>
                            {ganzhiLines.map(line => (
                                <div key={line} style={ganzhiLineStyle}>
                                    {line}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={headerActionsStyle}>
                    <div style={headerIconBtnStyle} onClick={() => navigate(paths.home.shake)}>
                        <span style={{ fontSize: '26px' }}>✦</span>
                    </div>
                    <div style={headerIconBtnStyle} onClick={() => navigate(paths.doubaoRealtimeDemo)}>
                        <span style={{ fontSize: '28px' }}>🎙</span>
                    </div>
                    <div style={settingsIconBtnStyle} onClick={() => navigate(paths.home.settings)}>
                        <span style={{ fontSize: '28px' }}>⚙</span>
                    </div>
                </div>
            </header>

            {/* ── 区域 B：周历条 ── */}
            <div style={{ ...weekCardStyle, animation: slideIn('150ms') }} onClick={() => navigate(paths.home.todo)}>
                <div style={weekInlineListStyle}>
                    {weekDays.map((day, i) => {
                        const isToday = isSameDay(day, now)
                        const dayKey = formatDateKey(day)
                        const todoCategories = weekTodoCategoryMap.get(dayKey) ?? []
                        const lunarText = getLunarDayText(day)
                        return (
                            <div key={i} style={isToday ? { ...weekInlineItemStyle, ...weekInlineItemActiveStyle } : weekInlineItemStyle}>
                                <span style={isToday ? weekInlineWeekdayActiveStyle : weekInlineWeekdayStyle}>
                                    {WEEKDAYS_CN[day.getDay()]}
                                </span>
                                <span style={isToday ? weekInlineDateActiveStyle : weekInlineDateStyle}>
                                    {formatWeekDayNumber(day)}
                                </span>
                                <span style={isToday ? weekInlineLunarActiveStyle : weekInlineLunarStyle}>{lunarText}</span>
                                <div style={weekInlineMarkersStyle}>
                                    {todoCategories.map(category => (
                                        <div
                                            key={category}
                                            style={{ width: '6px', height: '6px', borderRadius: radius.full, background: TODO_CATEGORY_COLORS[category], flexShrink: 0 }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── 区域 C：左信息区 + 右运势堆叠 ── */}
            <div style={{ ...dashboardStyle, animation: slideIn('300ms') }}>
                {/* 祈福待办 */}
                <div style={{ ...infoCardStyle, background: colors.fortune.blessing, cursor: 'pointer' }} onClick={() => navigate(paths.home.todo, { state: { selectedDate: nearestBlessingDate } })}>
                    <div style={todoCardHeaderRowStyle}>
                        <div style={bottomCardHeaderStyle}>
                            <span style={{ ...bottomCardTitleStyle, color: '#1e1405' }}>祈福事项</span>
                            <span style={{ ...bottomCardIconStyle, color: withAlpha('#1e1405', 0.70) }}>★</span>
                        </div>
                        {nearestBlessingDate && (
                            <span style={{ ...todoDateInlineStyle, color: withAlpha('#1e1405', 0.50) }}>{formatMonthDay(nearestBlessingDate)}</span>
                        )}
                    </div>
                    <div style={todoListStyle}>
                        {blessings.length === 0 && (
                            <span style={{ ...todoEmptyStyle, color: withAlpha('#1e1405', 0.50) }}>暂无祈福心愿，点击进入添加</span>
                        )}
                        {blessings.filter(b => b.date === nearestBlessingDate).map((b, i) => (
                            <div key={b.id ?? i} style={blessingTodoRowStyle}>
                                <div style={blessingTodoContentStyle}>
                                    <span style={blessingTodoItemStyle}>{b.item}</span>
                                    {b.reason && <span style={blessingTodoReasonStyle}>{b.reason}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 特殊日 */}
                <div style={{ ...infoCardStyle, background: colors.brand.light, gap: 4, cursor: firstSpecialDay ? 'pointer' : 'default' }}
                    ref={specialDayCardRef}
                    onClick={() => firstSpecialDay && handleOpenSpecialDay()}
                >
                    <div style={bottomCardHeaderStyle}>
                        <span style={{ ...bottomCardTitleStyle, color: '#1e1405' }}>特殊日</span>
                        <span style={{ ...bottomCardIconStyle, color: withAlpha('#1e1405', 0.70) }}>◎</span>
                    </div>
                    {firstSpecialDay ? (
                        <div style={specialDayItemsWrapperStyle}>
                            <div style={specialDayItemStyle}>
                                <div style={specialDayNameStyle}>
                                    {firstSpecialDay.data.dayName ?? firstSpecialDay.data.term ?? firstSpecialDay.data.relation ?? '今日特殊日'}
                                </div>
                                {firstSpecialDay.data.emotion && (
                                    <div style={specialDayEmotionTagStyle}>{firstSpecialDay.data.emotion}</div>
                                )}
                            </div>
                            {specialDays[1] && (
                                <div style={specialDayItemSecondStyle}>
                                    <div style={specialDayNameStyle}>
                                        {specialDays[1].data.dayName ?? specialDays[1].data.term ?? specialDays[1].data.relation ?? '今日特殊日'}
                                    </div>
                                    {specialDays[1].data.emotion && (
                                        <div style={specialDayEmotionTagStyle}>{specialDays[1].data.emotion}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ ...specialDayNameStyle, color: withAlpha('#1e1405', 0.45) }}>平稳无冲</div>
                    )}
                </div>

                {/* 今日运势 */}
                <div ref={fortunePaneRef} style={fortunePaneStyle}>
                    <div style={fortunePaneHeaderStyle}>
                        <div style={bottomCardHeaderStyle}>
                            <span style={fortunePaneTitleStyle}>今日运势</span>
                            <span style={bottomCardIconStyle}>✦</span>
                        </div>
                    </div>
                    <div style={fortuneStackViewportStyle} onClick={handleOpenFortune}>
                        {FORTUNE_ITEMS.map((item, index) => {
                            return (
                                <div
                                    key={item.key}
                                    style={{
                                        ...fortuneDeckCardStyle,
                                        transform: `translate(-50%, -50%) rotate(${FORTUNE_STACK_ROTATIONS[index]}deg) translateX(${(index - 1.5) * 48}px) translateY(${index * 4}px)`,
                                        zIndex: 10 + index,
                                        border: `1px solid ${withAlpha(item.color, 0.6)}`,
                                        boxShadow: `0 20px 40px ${item.color}22`,
                                        background: `linear-gradient(180deg, ${withAlpha(item.color, 0.36)} 0%, ${withAlpha(item.color, 0.30)} 100%)`,
                                    }}
                                >
                                    <div style={fortuneCardTopStyle}>
                                        <span style={{ ...cnTitleStyle, color: item.color, fontSize: '26px', writingMode: 'vertical-rl' }}>{item.cnTitle}</span>
                                        <div style={{ ...iconBoxStyle, background: `${item.color}22`, color: item.color }}>
                                            {item.icon}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* 今日运势展开浮层 */}
            <div
                style={isFortuneOverlayOpen ? fortuneOverlayOpenStyle : fortuneOverlayClosedStyle}
                onClick={() => setIsFortuneOverlayOpen(false)}
            >
                <div style={fortuneOverlayHeaderStyle}>
                    <span style={fortuneOverlayTitleStyle}>今日运势</span>
                </div>
                    <div style={fortuneOverlayStageStyle}>
                    {FORTUNE_ITEMS.map((item, index) => {
                        const viewedTags = fortuneViewedTags[item.key] ?? null
                        return (
                            <div
                                key={item.key}
                                style={{
                                    ...fortuneDeckCardStyle,
                                    ...getFortuneOverlayCardStyle(index, isFortuneOverlayOpen, item.color, fortuneSourceRect),
                                    border: `1px solid ${withAlpha(item.color, 0.6)}`,
                                    background: withAlpha(item.color, 0.38),
                                }}
                                onClick={e => {
                                    e.stopPropagation()
                                    navigate(fortuneTypePath(item.key), { state: { ganzhi: data?.date.ganzhi, lunar: data?.date.lunar } })
                                }}
                            >
                                {/* 背景图（未查看时显示，层级最低） */}
                                {!viewedTags && (
                                    <img
                                        src={item.image}
                                        style={fortuneCardBgImgStyle}
                                        alt=""
                                    />
                                )}
                                <div style={{ ...fortuneCardTopStyle, position: 'relative', zIndex: 1 }}>
                                    <span style={{ ...cnTitleStyle, color: item.color, fontSize: fontSize.xxl }}>{item.cnTitle}</span>
                                    <div style={{ ...iconBoxStyle, background: `${item.color}22`, color: item.color }}>
                                        {item.icon}
                                    </div>
                                </div>
                                {viewedTags ? (
                                    <div style={{ ...fortuneTagsRowStyle, position: 'relative', zIndex: 1 }}>
                                        {viewedTags.map((tag, i) => (
                                            <span key={i} style={{ ...fortuneTagStyle, borderColor: `${item.color}44`, color: item.color }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ ...fortuneOverlayActionStyle, position: 'relative', zIndex: 1 }}>查看详情</div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 特殊日展开浮层 */}
            <div
                style={isSpecialDayOverlayOpen ? fortuneOverlayOpenStyle : fortuneOverlayClosedStyle}
                onClick={() => setIsSpecialDayOverlayOpen(false)}
            >
                <div style={fortuneOverlayHeaderStyle}>
                    <span style={fortuneOverlayTitleStyle}>特殊日</span>
                </div>
                <div style={fortuneOverlayStageStyle}>
                    {specialDays.map((sd, index) => {
                        const title = sd.data.dayName ?? sd.data.term ?? sd.data.relation ?? '特殊日'
                        const subtitle = sd.data.dayName ? (sd.data.relation ?? sd.data.term ?? null) : null
                        const cardImg = getSpecialDayCardImg(sd)
                        const storeKey = `sd_${title}`
                        const viewedTags = fortuneViewedTags[storeKey] ?? null
                        return (
                            <div
                                key={index}
                                style={{
                                    ...fortuneDeckCardStyle,
                                    ...getSpecialDayOverlayCardStyle(index, specialDays.length, isSpecialDayOverlayOpen, specialDaySourceRect),
                                    border: `1px solid ${withAlpha(colors.brand.light, 0.6)}`,
                                    background: withAlpha(colors.brand.light, 0.38),
                                }}
                                onClick={e => {
                                    e.stopPropagation()
                                    // 进入详情前保存已查看标签
                                    if (sd.data.keywords) {
                                        const rawTags = (sd.data.keywords as string).split(/[,，、]/).map((t: string) => t.trim()).filter(Boolean)
                                        const tags: [string, string, string] = [rawTags[0] ?? '', rawTags[1] ?? '', rawTags[2] ?? '']
                                        saveFortuneViewedTags(storeKey, tags)
                                        setFortuneViewedTags(getAllFortuneViewedTags())
                                    }
                                    const activeBazi = getActiveBazi()
                                    const userGan = activeBazi ? baziHelpers.getEightCharByTime(activeBazi.bazi_real_sun_time).getDay().getHeavenStem().getName() : undefined
                                    const todayEc = baziHelpers.getEightCharByTime(Date.now())
                                    const todayGan = todayEc.getDay().getHeavenStem().getName()
                                    const todayZhi = todayEc.getDay().getEarthBranch().getName()
                                    const ganShiShen = userGan ? baziHelpers.getDayGanShiShen(userGan, todayGan) : undefined
                                    let zhiShiShen: string | undefined
                                    if (userGan) {
                                        try {
                                            const dayBranch = todayEc.getDay().getEarthBranch()
                                            const hideStems = dayBranch.getHideHeavenStems()
                                            if (hideStems.length > 0) {
                                                const mainStem = hideStems[0].getHeavenStem().getName()
                                                zhiShiShen = baziHelpers.getDayGanShiShen(userGan, mainStem)
                                            }
                                        } catch {}
                                    }
                                    navigate(paths.home.specialDay, { state: { title, emotion: sd.data.emotion, keywords: sd.data.keywords, interpretation: sd.data.interpretation, category: sd.category, relation: (sd.data as any).relation, term: (sd.data as any).term, modernName: (sd.data as any).modernName, dayGanzhi: data?.date.ganzhi, todayGan, todayZhi, userGan, ganShiShen, zhiShiShen } })
                                }}
                            >
                                {/* 背景图（未查看时显示） */}
                                {!viewedTags && cardImg && (
                                    <img src={cardImg} style={fortuneCardBgImgStyle} alt="" />
                                )}
                                <div style={{ ...fortuneCardTopStyle, position: 'relative', zIndex: 1 }}>
                                    <span style={{ ...cnTitleStyle, color: colors.fortune.special, fontSize: fontSize.lg }}>{title}</span>
                                </div>
                                {viewedTags ? (
                                    <div style={{ ...fortuneTagsRowStyle, position: 'relative', zIndex: 1 }}>
                                        {viewedTags.map((tag, i) => (
                                            <span key={i} style={{ ...fortuneTagStyle, borderColor: `${colors.fortune.special}44`, color: colors.fortune.special }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 1 }}>
                                        {subtitle && (
                                            <div style={specialDayOverlaySubtitleStyle}>{subtitle}</div>
                                        )}
                                        <div style={fortuneOverlayActionStyle}>查看详情</div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {specialDays.length === 0 && (
                        <div style={{ color: colors.text.muted, fontSize: fontSize.base, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                            今日无特殊日
                        </div>
                    )}
                </div>
            </div>
        </div>
        )}
        </>
    )
}

/* ─── Styles ─── */

const sleepScreenStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: '#000',
    zIndex: 0,
    overflow: 'hidden',
}

const screensaverVideoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
}

const wakeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '48px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 40px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '999px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '16px',
    letterSpacing: '4px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
}

const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: `${spacing.lg}px 64px`,
    gap: `${spacing.lg}px`,
    overflow: 'hidden',
}

const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
}

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
}

// 时钟与干支间距缩小
const headerMainStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.md}px`,
}

const clockStyle: React.CSSProperties = {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    lineHeight: 1,
    color: colors.text.primary,
    letterSpacing: '-4px',
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
}

const ganzhiBlockStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingTop: '20px',
    marginLeft: '4px',
}

const ganzhiLineStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    color: whiteAlpha(0.3),
    letterSpacing: '0.5px',
    lineHeight: 1.2,
}

// 右侧按钮整体下移
const headerActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: `${spacing.sm}px`,
    marginTop: '16px',
}

const headerIconBtnStyle: React.CSSProperties = {
    width: '54px',
    height: '54px',
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
}

const settingsIconBtnStyle: React.CSSProperties = {
    width: '54px',
    height: '54px',
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
}

// 周历条
const weekCardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    background: withAlpha(colors.brand.light, 0.28),
    border: 'none',
    borderRadius: radius.xl,
    padding: `${spacing.xs}px ${spacing.lg}px`,
    cursor: 'pointer',
    flexShrink: 0,
}

const weekInlineListStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: `${spacing.xs}px`,
    alignItems: 'center',
}

const weekInlineItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    minWidth: 0,
    padding: `4px 0`,
    borderRadius: radius.lg,
}

const weekInlineItemActiveStyle: React.CSSProperties = {
    background: withAlpha(colors.brand.light, 0.15),
    border: `1px solid ${colors.brand.light}`,
    borderRadius: radius.md,
}

const weekInlineWeekdayStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: withAlpha(colors.text.primary, 0.6),
    letterSpacing: '0.5px',
}

const weekInlineWeekdayActiveStyle: React.CSSProperties = {
    ...weekInlineWeekdayStyle,
    color: withAlpha(colors.brand.light, 0.7),
}

const weekInlineDateStyle: React.CSSProperties = {
    fontSize: fontSize.xl,
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
}

const weekInlineDateActiveStyle: React.CSSProperties = {
    ...weekInlineDateStyle,
    color: withAlpha(colors.brand.light, 1),
}

const weekInlineLunarStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: withAlpha(colors.text.primary, 0.3),
    lineHeight: 1.1,
}

const weekInlineLunarActiveStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: withAlpha(colors.brand.light, 0.6),
    lineHeight: 1.1,
}

const weekInlineMarkersStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    height: '6px',
    alignItems: 'center',
}

const dashboardStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 2fr) minmax(0, 3fr)',
    gap: `${spacing.lg}px`,
    flex: 1,
    minHeight: 0,
}

const infoCardStyle: React.CSSProperties = {
    background: brandAlpha(0.14),
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.xl,
    padding: `${spacing.lg}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.sm}px`,
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
}

const fortunePaneStyle: React.CSSProperties = {
    position: 'relative',
    minHeight: 0,
    minWidth: 0,
    background: 'rgb(77 67 50 / 1)',
    border: 'none',
    borderRadius: radius.xl,
    overflow: 'hidden',
}

const fortunePaneHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md}px ${spacing.lg}px 0`,
    position: 'relative',
    zIndex: 2,
}

const fortunePaneTitleStyle: React.CSSProperties = {
    fontSize: fontSize.md,
    color: colors.brand.light,
    letterSpacing: '1px',
    fontWeight: fontWeight.semibold,
}

const fortuneStackViewportStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    minHeight: 0,
    cursor: 'pointer',
    overflow: 'hidden',
}

const iconBoxStyle: React.CSSProperties = {
    width: '56px',
    height: '56px',
    borderRadius: radius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    flexShrink: 0,
}

const cnTitleStyle: React.CSSProperties = {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
}

const fortuneDeckCardStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '54%',
    height: '82%',
    width: 'auto',
    aspectRatio: '3 / 4',
    maxHeight: '420px',
    maxWidth: '78%',
    background: 'transparent',
    borderRadius: '28px',
    padding: `${spacing.lg}px`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    backdropFilter: 'blur(12px)',
    transition: 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease, box-shadow 260ms ease',
    overflow: 'hidden',
}

// 标题在左，图标在右
const fortuneCardTopStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: `${spacing.md}px`,
}


const fortuneCardBgImgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    opacity: 0.34,
    zIndex: 0,
    borderRadius: '28px',
    pointerEvents: 'none',
}

const fortuneTagsRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignSelf: 'flex-start',
}

const fortuneTagStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    padding: '8px 16px',
    borderRadius: radius.full,
    border: '1px solid',
    background: 'transparent',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
}

const fortuneOverlayActionStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    fontSize: fontSize.xs,
    color: withAlpha('#1e1405', 0.72),
    background: withAlpha('#1e1405', 0.16),
    borderRadius: radius.full,
    padding: '6px 12px',
}

const fortuneOverlayClosedStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0)',
    backdropFilter: 'blur(0px)',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 260ms ease, background 260ms ease, backdrop-filter 260ms ease',
    zIndex: 30,
}

const fortuneOverlayOpenStyle: React.CSSProperties = {
    ...fortuneOverlayClosedStyle,
    background: 'rgba(0, 0, 0, 0.72)',
    backdropFilter: 'blur(12px)',
    opacity: 1,
    pointerEvents: 'auto',
}

const fortuneOverlayHeaderStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${spacing.xl}px`,
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
}

const fortuneOverlayTitleStyle: React.CSSProperties = {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
}


const fortuneOverlayStageStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
}

const bottomCardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
}

const bottomCardTitleStyle: React.CSSProperties = {
    fontSize: fontSize.md,
    color: colors.brand.light,
    letterSpacing: '1px',
    fontWeight: fontWeight.semibold,
}

const bottomCardIconStyle: React.CSSProperties = {
    fontSize: fontSize.md,
    color: colors.brand.light,
    lineHeight: 1,
}

// 特殊日单个日子的 box（name + tag 包裹）
const specialDayItemsWrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
}

const specialDayItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `10px`,
    padding: `12px 0 16px 0`,
}

// 特殊日第二个日子（加 border-top 作为分隔线）
const specialDayItemSecondStyle: React.CSSProperties = {
    ...specialDayItemStyle,
    borderTop: `1px solid ${withAlpha('#1e1405', 0.15)}`,
}

// 特殊日名称（大字标题）
const specialDayNameStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: '#1e1405',
    lineHeight: 1.3,
}

// 特殊日浮层卡片副标题（技术名称）
const specialDayOverlaySubtitleStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: withAlpha(colors.fortune.special, 0.7),
    letterSpacing: '0.5px',
}

// 特殊日情绪标签（标题下方）
const specialDayEmotionTagStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: withAlpha('#1e1405', 0.55),
    background: withAlpha('#1e1405', 0.10),
    borderRadius: radius.full,
    padding: '2px 10px',
    alignSelf: 'flex-start',
    whiteSpace: 'nowrap',
}

// 祈福待办：标题行（标题 + 日期标签）
const todoCardHeaderRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
}

// 标题右侧日期：纯文字，无底色
const todoDateInlineStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: whiteAlpha(0.4),
    letterSpacing: '0.5px',
}

// 待办列表容器
const todoListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
}

// 祈福卡片待办行（分割线用 onBright 基准色）
const blessingTodoRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 0',
    borderTop: `1px solid ${withAlpha('#1e1405', 0.15)}`,
}

const blessingTodoContentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
}

const blessingTodoItemStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: '#1e1405',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
}

const blessingTodoReasonStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: withAlpha('#1e1405', 0.68),
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
}

// 空状态文字
const todoEmptyStyle: React.CSSProperties = {
    fontSize: fontSize.base,
    color: colors.text.muted,
    lineHeight: 1.6,
}

function getFortuneOverlayCardStyle(index: number, isOpen: boolean, color: string, sourceRect: DOMRect | null): React.CSSProperties {
    const openXOffsets = [-306, -111, 111, 306]
    const openYOffsets = [35, -10, -10, 35]

    // 动画起点：从运势面板的实际位置出发
    let closedX: number
    let closedY: number
    if (sourceRect) {
        const vpCX = window.innerWidth / 2
        const vpCY = window.innerHeight * 0.52
        const srcCX = sourceRect.left + sourceRect.width / 2
        const srcCY = sourceRect.top + sourceRect.height / 2
        closedX = srcCX - vpCX + (index - 1.5) * 20
        closedY = srcCY - vpCY + (index - 1.5) * 6
    } else {
        closedX = 220 + index * 18
        closedY = 24 - index * 10
    }

    return {
        top: '52%',
        left: '50%',
        height: 'min(50vh, 380px)',
        width: 'auto',
        zIndex: 40 + index,
        opacity: isOpen ? 1 : 0,
        border: `1px solid ${withAlpha(color, 0.60)}`,
        boxShadow: isOpen ? `0 26px 60px ${color}26` : `0 12px 26px ${color}18`,
        transform: isOpen
            ? `translate(calc(-50% + ${openXOffsets[index]}px), calc(-50% + ${openYOffsets[index]}px)) rotate(${FORTUNE_OVERLAY_ROTATIONS[index]}deg)`
            : `translate(calc(-50% + ${closedX}px), calc(-50% + ${closedY}px)) rotate(${FORTUNE_STACK_ROTATIONS[index]}deg) scale(0.82)`,
    }
}

function getSpecialDayOverlayCardStyle(index: number, total: number, isOpen: boolean, sourceRect: DOMRect | null): React.CSSProperties {
    const count = Math.min(total, 4)
    // 根据卡片数量动态计算 X 间距，均匀分布
    const xStep = 240
    const startX = -(count - 1) * xStep / 2
    const openXOffsets = Array.from({ length: count }, (_, i) => startX + i * xStep)
    // Y 偏移：1张居中，2张同高，3/4张轻微拱形
    const yOffsetMap: Record<number, number[]> = { 1: [0], 2: [0, 0], 3: [20, -10, 20], 4: [20, -10, -10, 20] }
    const openYOffsets = yOffsetMap[count] ?? [0]
    // 旋转：始终以0为中轴对称均匀分布，垂直方向正中的牌旋转为0
    const maxRotation = count <= 1 ? 0 : count === 2 ? 8 : count === 3 ? 10 : 15
    const rotations = Array.from({ length: count }, (_, i) => {
        if (count === 1) return 0
        return -maxRotation + i * (2 * maxRotation / (count - 1))
    })

    // 动画起点：从特殊日卡片的实际位置出发
    let closedX: number
    let closedY: number
    if (sourceRect) {
        const vpCX = window.innerWidth / 2
        const vpCY = window.innerHeight * 0.52
        const srcCX = sourceRect.left + sourceRect.width / 2
        const srcCY = sourceRect.top + sourceRect.height / 2
        closedX = srcCX - vpCX + index * 16
        closedY = srcCY - vpCY + index * 6
    } else {
        closedX = 200 + index * 20
        closedY = 0
    }

    return {
        top: '52%',
        left: '50%',
        height: 'min(50vh, 380px)',
        width: 'auto',
        zIndex: 40 + index,
        opacity: isOpen ? 1 : 0,
        border: `1px solid ${colors.brand.borderStrong}`,
        boxShadow: isOpen ? `0 26px 60px ${brandAlpha(0.2)}` : 'none',
        transform: isOpen
            ? `translate(calc(-50% + ${openXOffsets[index]}px), calc(-50% + ${openYOffsets[index] ?? 0}px)) rotate(${rotations[index] ?? 0}deg)`
            : `translate(calc(-50% + ${closedX}px), calc(-50% + ${closedY}px)) rotate(${FORTUNE_STACK_ROTATIONS[index]}deg) scale(0.82)`,
    }
}
