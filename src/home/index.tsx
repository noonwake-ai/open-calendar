import React, { ReactElement, useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths, fortuneTypePath } from '../router/urls'
import { callApi } from '../utils/api'
import { apis } from '../utils/api'
import { getDeviceToken } from '../utils/device'
import { startBaziPolling, getActiveBazi } from '../utils/bazi-store'
import baziHelpers from '../common/helpers/bazi-helpers'
import { fetchUserInfo, getUser } from '../utils/user-store'
import { Blessing, listAllBlessings } from '../utils/local-db'
import { colors, fontSize, fontWeight, radius, spacing, whiteAlpha, brandAlpha, withAlpha } from '../styles/tokens'
import { SolarDay } from 'tyme4ts'
import { INITIAL_TODOS, formatDateKey } from './todo-calendar'
import { buildTodoCategoryMap, TODO_CATEGORY_COLORS } from './todo-meta'
import { getAllFortuneViewedTags, saveFortuneViewedTags } from '../utils/fortune-viewed-store'

type HomeData = NonNullable<typeof apis.pi.home.today['_resp']>

const WEEKDAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const FORTUNE_ITEMS = [
    { key: 'love',   icon: '♥', cnTitle: '桃花', color: TODO_CATEGORY_COLORS.love,   image: '/fortune-love.png' },
    { key: 'career', icon: '❖', cnTitle: '事业', color: TODO_CATEGORY_COLORS.career, image: '/fortune-career.png' },
    { key: 'wealth', icon: '¥', cnTitle: '财运', color: TODO_CATEGORY_COLORS.wealth, image: '/fortune-wealth.png' },
    { key: 'study',  icon: '✎', cnTitle: '学业', color: TODO_CATEGORY_COLORS.study,  image: '/fortune-study.png' },
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

const TODO_CATEGORY_MAP = buildTodoCategoryMap(INITIAL_TODOS)

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
                    item: t.text,
                    date: t.date,
                    hexagramName: '',
                    question: '',
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

    // 从详情页返回时刷新已查看状态
    useEffect(() => {
        const onFocus = () => setFortuneViewedTags(getAllFortuneViewedTags())
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [])

    if (loading) {
        return (
            <div style={loadingStyle}>
                <p style={{ color: colors.text.muted, fontSize: fontSize.md }}>加载中...</p>
            </div>
        )
    }

    const weekDays = getWeekDays(now)
    const specialDays = data?.specialDays ?? []
    const firstSpecialDay = specialDays[0] ?? null
    const ganzhiLines = getGanzhiLines(data?.date.ganzhi ?? '')
    const nearestBlessingDate = [...blessings]
        .sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? null
    const blessingDates = new Set(blessings.map(b => b.date))
    return (
        <div style={pageStyle}>
            {/* ── 区域 A：顶部栏（时钟 + 干支） ── */}
            <header style={headerStyle}>
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
            <div style={weekCardStyle} onClick={() => navigate(paths.home.todo)}>
                <div style={weekInlineListStyle}>
                    {weekDays.map((day, i) => {
                        const isToday = isSameDay(day, now)
                        const dayKey = formatDateKey(day)
                        const todoCategories = TODO_CATEGORY_MAP.get(dayKey) ?? []
                        const hasBlessing = blessingDates.has(dayKey)
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
                                    {hasBlessing && <span style={{ ...weekStarStyle, color: colors.fortune.blessing }}>★</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── 区域 C：左信息区 + 右运势堆叠 ── */}
            <div style={dashboardStyle}>
                {/* 祈福待办 */}
                <div style={{ ...infoCardStyle, background: withAlpha(colors.fortune.blessing, 0.07), cursor: 'pointer' }} onClick={() => navigate(paths.home.todo, { state: { selectedDate: nearestBlessingDate } })}>
                    <div style={todoCardHeaderRowStyle}>
                        <div style={bottomCardHeaderStyle}>
                            <span style={{ ...bottomCardTitleStyle, color: colors.fortune.blessing }}>祈福事项</span>
                            <span style={{ ...bottomCardIconStyle, color: colors.fortune.blessing }}>★</span>
                        </div>
                        {nearestBlessingDate && (
                            <span style={todoDateInlineStyle}>{formatMonthDay(nearestBlessingDate)}</span>
                        )}
                    </div>
                    <div style={todoListStyle}>
                        {blessings.length === 0 && (
                            <span style={todoEmptyStyle}>暂无祈福心愿，点击进入添加</span>
                        )}
                        {blessings.filter(b => b.date === nearestBlessingDate).map((b, i) => (
                            <div key={b.id ?? i} style={blessingTodoRowStyle}>
                                <span style={todoRowTextStyle}>{b.item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 特殊日 */}
                <div style={{ ...infoCardStyle, cursor: firstSpecialDay ? 'pointer' : 'default' }}
                    ref={specialDayCardRef}
                    onClick={() => firstSpecialDay && handleOpenSpecialDay()}
                >
                    <div style={bottomCardHeaderStyle}>
                        <span style={bottomCardTitleStyle}>特殊日</span>
                        <span style={bottomCardIconStyle}>◎</span>
                    </div>
                    {firstSpecialDay ? (
                        <>
                            <div style={specialDayNameStyle}>
                                {firstSpecialDay.data.dayName ?? firstSpecialDay.data.term ?? firstSpecialDay.data.relation ?? '今日特殊日'}
                            </div>
                            {firstSpecialDay.data.emotion && (
                                <div style={specialDayEmotionTagStyle}>{firstSpecialDay.data.emotion}</div>
                            )}
                            {specialDays[1] && (
                                <>
                                    <div style={specialDayDividerStyle} />
                                    <div style={specialDayNameStyle}>
                                        {specialDays[1].data.dayName ?? specialDays[1].data.term ?? specialDays[1].data.relation ?? '今日特殊日'}
                                    </div>
                                    {specialDays[1].data.emotion && (
                                        <div style={specialDayEmotionTagStyle}>{specialDays[1].data.emotion}</div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        <div style={{ ...specialDayNameStyle, color: whiteAlpha(0.45) }}>平稳无冲</div>
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
                                        border: `1px solid ${item.color}44`,
                                        boxShadow: `0 20px 40px ${item.color}22`,
                                        background: `linear-gradient(180deg, ${withAlpha(item.color, 0.12)} 0%, ${withAlpha(item.color, 0.06)} 100%)`,
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
                                    background: `linear-gradient(180deg, ${withAlpha(item.color, 0.15)} 0%, ${withAlpha(item.color, 0.07)} 100%)`,
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
                                {!viewedTags && (
                                    <div
                                        style={fortuneDevSimStyle}
                                        onClick={e => {
                                            e.stopPropagation()
                                            const mockTags: Record<string, [string, string, string]> = {
                                                love:   ['桃花旺盛', '真心相遇', '情感升温'],
                                                career: ['贵人相助', '稳中求进', '机遇涌现'],
                                                wealth: ['财源广进', '偏财旺盛', '投资有利'],
                                                study:  ['思维敏捷', '灵感爆发', '学有所成'],
                                            }
                                            saveFortuneViewedTags(item.key, mockTags[item.key])
                                            setFortuneViewedTags(getAllFortuneViewedTags())
                                        }}
                                    >
                                        模拟已查看
                                    </div>
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
                        return (
                            <div
                                key={index}
                                style={{
                                    ...fortuneDeckCardStyle,
                                    ...getSpecialDayOverlayCardStyle(index, specialDays.length, isSpecialDayOverlayOpen, specialDaySourceRect),
                                }}
                                onClick={e => {
                                    e.stopPropagation()
                                    const activeBazi = getActiveBazi()
                                    const userGan = activeBazi ? baziHelpers.getEightCharByTime(activeBazi.bazi_real_sun_time).getDay().getHeavenStem().getName() : undefined
                                    const todayEc = baziHelpers.getEightCharByTime(Date.now())
                                    const todayGan = todayEc.getDay().getHeavenStem().getName()
                                    const todayZhi = todayEc.getDay().getEarthBranch().getName()
                                    const ganShiShen = userGan ? baziHelpers.getDayGanShiShen(userGan, todayGan) : undefined
                                    // zhiShiShen: 取日地支藏干主气对日主的十神
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
                                <span style={{ ...cnTitleStyle, color: colors.fortune.special }}>{title}</span>
                                {sd.data.emotion && (
                                    <div style={specialDayEmotionTagStyle}>{sd.data.emotion}</div>
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
    )
}

/* ─── Styles ─── */

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
    fontSize: fontSize.base,
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
    background: withAlpha(colors.brand.light, 0.13),
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
    gap: '8px',
    minWidth: 0,
    padding: `${spacing.xs}px 0`,
    borderRadius: radius.lg,
}

const weekInlineItemActiveStyle: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${withAlpha(colors.brand.light, 0.8)}`,
    borderRadius: radius.md,
}

const weekInlineWeekdayStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: withAlpha(colors.text.primary, 0.6),
    letterSpacing: '0.5px',
}

const weekInlineWeekdayActiveStyle: React.CSSProperties = {
    ...weekInlineWeekdayStyle,
    color: withAlpha(colors.brand.light, 0.7),
}

const weekInlineDateStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
}

const weekInlineDateActiveStyle: React.CSSProperties = {
    ...weekInlineDateStyle,
    color: withAlpha(colors.brand.light, 1),
}

const weekInlineLunarStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: withAlpha(colors.text.primary, 0.3),
    lineHeight: 1.1,
}

const weekInlineLunarActiveStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: withAlpha(colors.brand.light, 0.6),
    lineHeight: 1.1,
}

const weekInlineMarkersStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    height: '6px',
    alignItems: 'center',
}

const weekStarStyle: React.CSSProperties = {
    fontSize: '8px',
    lineHeight: 1,
    flexShrink: 0,
}

const dashboardStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 2fr) minmax(0, 3fr)',
    gap: `${spacing.lg}px`,
    flex: 1,
    minHeight: 0,
}

const infoCardStyle: React.CSSProperties = {
    background: colors.bg.overlay,
    border: 'none',
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
    background: `linear-gradient(180deg, ${brandAlpha(0.06)} 0%, ${brandAlpha(0.12)} 100%)`,
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
    fontSize: fontSize.sm,
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
    opacity: 0.2,
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

const fortuneDevSimStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    fontSize: '11px',
    color: withAlpha('#ffffff', 0.35),
    background: withAlpha('#ffffff', 0.07),
    border: `1px solid ${withAlpha('#ffffff', 0.15)}`,
    borderRadius: radius.sm,
    padding: '4px 8px',
    cursor: 'pointer',
}

const fortuneOverlayActionStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    fontSize: fontSize.xs,
    color: withAlpha(colors.text.primary, 0.55),
    background: withAlpha(colors.text.primary, 0.08),
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
    marginBottom: '2px',
}

const bottomCardTitleStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: colors.brand.light,
    letterSpacing: '1px',
    fontWeight: fontWeight.semibold,
}

const bottomCardIconStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: colors.brand.light,
    lineHeight: 1,
}

// 特殊日分割线
const specialDayDividerStyle: React.CSSProperties = {
    width: '100%',
    height: '1px',
    background: withAlpha(colors.fortune.special, 0.15),
    margin: `${spacing.xs / 2}px 0`,
}

// 特殊日名称（大字标题）
const specialDayNameStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.fortune.special,
    lineHeight: 1.3,
}

// 特殊日情绪标签（标题下方）
const specialDayEmotionTagStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    background: colors.bg.overlayActive,
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

// 待办列表每一行
const todoRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 0',
    borderTop: `1px solid ${colors.brand.border}`,
}

// 祈福卡片待办行（分割线用青色，透明度更低）
const blessingTodoRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 0',
    borderTop: `1px solid ${withAlpha(colors.fortune.blessing, 0.15)}`,
}

// 待办文字
const todoRowTextStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: whiteAlpha(0.75),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
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
        border: `1px solid ${color}55`,
        boxShadow: isOpen ? `0 26px 60px ${color}26` : `0 12px 26px ${color}18`,
        transform: isOpen
            ? `translate(calc(-50% + ${openXOffsets[index]}px), calc(-50% + ${openYOffsets[index]}px)) rotate(${FORTUNE_OVERLAY_ROTATIONS[index]}deg)`
            : `translate(calc(-50% + ${closedX}px), calc(-50% + ${closedY}px)) rotate(${FORTUNE_STACK_ROTATIONS[index]}deg) scale(0.82)`,
    }
}

function getSpecialDayOverlayCardStyle(index: number, total: number, isOpen: boolean, sourceRect: DOMRect | null): React.CSSProperties {
    const count = Math.min(total, 4)
    // 根据卡片数量动态计算 X 间距，均匀分布
    const xStep = 195
    const startX = -(count - 1) * xStep / 2
    const openXOffsets = Array.from({ length: count }, (_, i) => startX + i * xStep)
    // Y 偏移：1张居中，多张拱形
    const openYOffsets = count === 1 ? [0] : [35, -10, -10, 35].slice(0, count)
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
