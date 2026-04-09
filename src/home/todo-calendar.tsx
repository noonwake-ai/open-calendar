import React, { ReactElement, useEffect, useState } from 'react'
import { paths } from '../router/urls'
import { useLocation } from 'react-router-dom'
import { colors, fontSize, fontWeight, radius, spacing, withAlpha } from '../styles/tokens'
import { SolarDay } from 'tyme4ts'
import BackButton from '../components/back-button'
import { Blessing, listAllBlessings, toggleBlessingCompleted } from '../utils/local-db'
import { buildTodoCategoryMap, TODO_CATEGORY_COLORS, TodoCategoryKey } from './todo-meta'

const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六']

const CATEGORY_META: Record<TodoCategoryKey, { icon: string; label: string; color: string }> = {
    love:    { icon: '♥', label: '桃花', color: TODO_CATEGORY_COLORS.love },
    career:  { icon: '❖', label: '事业', color: TODO_CATEGORY_COLORS.career },
    wealth:  { icon: '¥', label: '财运', color: TODO_CATEGORY_COLORS.wealth },
    study:   { icon: '✎', label: '学业', color: TODO_CATEGORY_COLORS.study },
}

export interface TodoItem {
    id: string
    item: string
    reason: string
    tag: TodoCategoryKey
    question: string
    hexagramName: string
    time?: string
    completed: boolean
    date: string // "YYYY-MM-DD"
}

// 历史模拟数据：用于比赛演示，表示用户此前摇卦后沉淀下来的祈福事项。
// 要求：每条都必须能追溯到具体问题，不能写成泛化待办。
export const INITIAL_TODOS: TodoItem[] = [
    { id: '1',  date: '2026-04-01', time: '07:00', item: '定一志愿', reason: '目标不钉住，后面复习很容易越学越散', tag: 'study', question: '年底考研如何？', hexagramName: '乾', completed: false },
    { id: '3',  date: '2026-04-01', time: '13:00', item: '补数学错题', reason: '反复失分不止住，冲刺期会越学越慌', tag: 'study', question: '年底考研如何？', hexagramName: '乾', completed: true },
    { id: '5',  date: '2026-04-03', time: '09:00', item: '改简历首屏', reason: '第一眼没打中重点，机会容易直接滑走', tag: 'career', question: '今年跳槽能成吗？', hexagramName: '晋', completed: true },
    { id: '6',  date: '2026-04-03', time: '14:00', item: '谈清薪资线', reason: '这次卡点不在机会，在你敢不敢谈底线', tag: 'wealth', question: '今年跳槽能成吗？', hexagramName: '晋', completed: false },
    { id: '7',  date: '2026-04-05', time: '20:00', item: '先停追问', reason: '你越急着求答案，对方越容易往后退', tag: 'love', question: '还能和前任复合吗？', hexagramName: '复', completed: false },
    { id: '8',  date: '2026-04-05', item: '发次近况', reason: '这次宜轻轻递话，不宜把情绪一下倒满', tag: 'love', question: '还能和前任复合吗？', hexagramName: '复', completed: false },
    { id: '9',  date: '2026-04-09', time: '10:00', item: '先看回撤', reason: '现在先看能亏多少，不是先想能赚多少', tag: 'wealth', question: '这笔投资能做吗？', hexagramName: '节', completed: false },
    { id: '10', date: '2026-04-11', time: '14:00', item: '先通口径', reason: '两边期待不对齐，见面越早越容易别扭', tag: 'love', question: '这段关系要不要见家长？', hexagramName: '家人', completed: false },
    { id: '11', date: '2026-04-11', item: '定见面界线', reason: '先说好聊到哪，不然现场容易失分', tag: 'love', question: '这段关系要不要见家长？', hexagramName: '家人', completed: false },
    { id: '12', date: '2026-04-11', time: '15:00', item: '复盘错题', reason: '临时抱佛脚没用，先找最常错的点', tag: 'study', question: '年底考研如何？', hexagramName: '乾', completed: false },
    { id: '13', date: '2026-04-14', time: '11:00', item: '先做体检', reason: '这件事先看身体底子，别只靠心急往前冲', tag: 'love', question: '今年要不要备孕？', hexagramName: '家人', completed: false },
    { id: '14', date: '2026-04-18', time: '10:00', item: '重排作息', reason: '后劲比猛冲更要紧，先把高效时段固定住', tag: 'study', question: '年底考研如何？', hexagramName: '乾', completed: false },
    { id: '15', date: '2026-04-18', time: '18:30', item: '约短见面', reason: '关系要不要续，见一面比隔空猜更准', tag: 'love', question: '还能和前任复合吗？', hexagramName: '复', completed: false },
    { id: '2',  date: '2026-04-22', item: '别急定性', reason: '现在还在试探期，太快下结论容易看偏', tag: 'love', question: '相亲对象值得继续吗？', hexagramName: '咸', completed: false },
    { id: '4',  date: '2026-04-22', time: '18:00', item: '约家里聊聊', reason: '先听家里真实顾虑，别临见面再补漏洞', tag: 'love', question: '这段关系要不要见家长？', hexagramName: '家人', completed: false },
    { id: '16', date: '2026-04-22', time: '10:00', item: '学一小节', reason: '别想着全补完，先吃透最卡的一个点', tag: 'study', question: '年底考研如何？', hexagramName: '乾', completed: false },
    { id: '17', date: '2026-04-26', time: '09:30', item: '先算保本线', reason: '眼下最怕热血上头，账一不清后面全乱', tag: 'wealth', question: '现在适合创业开店吗？', hexagramName: '鼎', completed: false },
    { id: '18', date: '2026-04-26', time: '16:00', item: '谈清分工', reason: '合伙最怕好话说满，丑话没先摆清', tag: 'career', question: '现在适合创业开店吗？', hexagramName: '鼎', completed: false },
    { id: '19', date: '2026-05-04', time: '10:00', item: '读真题卷', reason: '别再乱刷资料，先摸清出题人的脾气', tag: 'study', question: '年底考研如何？', hexagramName: '乾', completed: false },
    { id: '20', date: '2026-05-08', time: '10:00', item: '写退出线', reason: '没退路的决定，后面最容易越补越乱', tag: 'wealth', question: '这笔投资能做吗？', hexagramName: '节', completed: false },
    { id: '21', date: '2026-05-08', time: '14:00', item: '投三家公司', reason: '这阵子宜稳不宜散，少投但要投得准', tag: 'career', question: '今年跳槽能成吗？', hexagramName: '晋', completed: false },
    { id: '22', date: '2026-05-13', time: '18:00', item: '准备见面', reason: '别只在线上聊，见面后的感受才最准', tag: 'love', question: '相亲对象值得继续吗？', hexagramName: '咸', completed: false },
    { id: '23', date: '2026-04-09', time: '15:00', item: '查资金锁期', reason: '流动性一锁死，后面想转身就难了', tag: 'wealth', question: '这笔投资能做吗？', hexagramName: '节', completed: false },
    { id: '24', date: '2026-04-22', time: '11:00', item: '只下小仓', reason: '这卦不怕试，就怕一把压重把心态压坏', tag: 'wealth', question: '这笔投资能做吗？', hexagramName: '节', completed: false },
]

export function formatDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
    return new Date(year, month, 1).getDay()
}

function getLunarDayText(year: number, month: number, day: number): string {
    try {
        const solar = SolarDay.fromYmd(year, month + 1, day)
        return solar.getLunarDay().getName()
    } catch {
        return ''
    }
}


export default function TodoCalendar(): ReactElement {
    const today = new Date()
    const location = useLocation()
    const initDateKey = (location.state as any)?.selectedDate ?? formatDateKey(today)
    const initDate = new Date(initDateKey + 'T00:00:00')
    const [currentYear, setCurrentYear] = useState(initDate.getFullYear())
    const [currentMonth, setCurrentMonth] = useState(initDate.getMonth())
    const [selectedDate, setSelectedDate] = useState(initDateKey)
    const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS)
    const [blessings, setBlessings] = useState<Blessing[]>([])

    const todoCategoryMap = buildTodoCategoryMap(todos)
    const blessingDates = new Set(blessings.filter(b => !b.completed).map(b => b.date))
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth)

    useEffect(() => {
        listAllBlessings().then(setBlessings)
    }, [])

    const prevMonth = () => {
        if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11) }
        else setCurrentMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0) }
        else setCurrentMonth(m => m + 1)
    }

    const toggleTodo = (id: string) => {
        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
    }

    const toggleBlessing = async (id: number) => {
        await toggleBlessingCompleted(id)
        setBlessings(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item))
    }

    const selectedTodos = todos.filter(t => t.date === selectedDate)
    const selectedBlessings = blessings.filter(b => b.date === selectedDate)
    const selectedDay = new Date(selectedDate)
    const selectedLabel = `${selectedDay.getMonth() + 1}月${selectedDay.getDate()}日`

    // Group todos by category, sorted by earliest time in each group
    const todoByCategoryEntries: Array<{ meta: { icon: string; label: string; color: string }; items: TodoItem[] }> = []
    for (const [key, meta] of Object.entries(CATEGORY_META) as [TodoCategoryKey, typeof CATEGORY_META[TodoCategoryKey]][]) {
        const items = selectedTodos.filter(t => t.tag === key)
        if (items.length > 0) todoByCategoryEntries.push({ meta, items })
    }
    todoByCategoryEntries.sort((a, b) => {
        const earliest = (items: TodoItem[]) => items.reduce((min, t) => t.time && t.time < min ? t.time : min, '99:99')
        return earliest(a.items).localeCompare(earliest(b.items))
    })

    // Build calendar grid cells
    const cells: Array<{ day: number; key: string; isCurrentMonth: boolean; year: number; month: number }> = []
    const prevMonthDays = getDaysInMonth(
        currentMonth === 0 ? currentYear - 1 : currentYear,
        currentMonth === 0 ? 11 : currentMonth - 1,
    )
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const d = prevMonthDays - i
        const m = currentMonth === 0 ? 11 : currentMonth - 1
        const y = currentMonth === 0 ? currentYear - 1 : currentYear
        cells.push({ day: d, key: formatDateKey(new Date(y, m, d)), isCurrentMonth: false, year: y, month: m })
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, key: formatDateKey(new Date(currentYear, currentMonth, d)), isCurrentMonth: true, year: currentYear, month: currentMonth })
    }
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
        const m = currentMonth === 11 ? 0 : currentMonth + 1
        const y = currentMonth === 11 ? currentYear + 1 : currentYear
        cells.push({ day: d, key: formatDateKey(new Date(y, m, d)), isCurrentMonth: false, year: y, month: m })
    }

    const todayKey = formatDateKey(today)

    return (
        <div style={pageStyle}>
            <BackButton to={paths.home.index} />

            {/* ── 左侧：月历 ── */}
            <div style={calendarPanelStyle}>
                <div style={monthNavStyle}>
                    <button onClick={prevMonth} style={navBtnStyle}>◂</button>
                    <span style={monthLabelStyle}>{currentYear}年{currentMonth + 1}月</span>
                    <button onClick={nextMonth} style={{ ...navBtnStyle, transform: 'scaleX(-1)' }}>◂</button>
                </div>

                <div style={weekHeaderStyle}>
                    {WEEKDAYS_CN.map(w => (
                        <span key={w} style={weekHeaderCellStyle}>{w}</span>
                    ))}
                </div>

                <div style={calendarGridStyle}>
                    {cells.map((cell, i) => {
                        const isToday = cell.key === todayKey
                        const isSelected = cell.key === selectedDate
                        const dayCategories = todoCategoryMap.get(cell.key) ?? []
                        const hasBlessing = blessingDates.has(cell.key)
                        const lunarText = getLunarDayText(cell.year, cell.month, cell.day)

                        let cellStyle: React.CSSProperties = { ...dayCellBase }
                        if (!cell.isCurrentMonth) cellStyle = { ...cellStyle, opacity: 0.3 }
                        if (isSelected) cellStyle = { ...cellStyle, background: withAlpha(colors.brand.light, 0.13) }
                        if (isToday) cellStyle = { ...cellStyle, border: `1px solid ${withAlpha(colors.brand.light, 0.8)}` }

                        return (
                            <div
                                key={i}
                                style={cellStyle}
                                onClick={() => { if (cell.isCurrentMonth) setSelectedDate(cell.key) }}
                            >
                                <span style={{
                                    fontSize: fontSize.md,
                                    fontWeight: fontWeight.semibold,
                                    color: isSelected ? withAlpha(colors.brand.light, 1) : isToday ? colors.brand.light : colors.text.primary,
                                }}>
                                    {cell.day}
                                </span>
                                <span style={{ fontSize: '11px', color: (isSelected || isToday) ? withAlpha(colors.brand.light, 0.6) : withAlpha(colors.text.primary, 0.3), marginTop: '1px', minHeight: '14px' }}>
                                    {lunarText}
                                </span>
                                {/* 始终占位，保证所有格子等高 */}
                                <div style={calendarMarkerRowStyle}>
                                    {dayCategories.map(category => (
                                        <div
                                            key={category}
                                            style={{ ...calTodoDotStyle, background: TODO_CATEGORY_COLORS[category] }}
                                        />
                                    ))}
                                    {hasBlessing && <span style={calBlessingStarStyle}>★</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── 右侧：待办列表 ── */}
            <div style={todoPanelStyle}>
                <h2 style={todoTitleStyle}>{selectedLabel}</h2>

                <div style={todoListStyle}>
                    {selectedBlessings.length === 0 && selectedTodos.length === 0 ? (
                        <p style={emptyStyle}>今日暂无待办</p>
                    ) : (
                        <>
                            {/* 祈福分组 */}
                            {selectedBlessings.length > 0 && (
                                <div style={todoGroupStyle}>
                                    <div style={{ ...categoryTagStyle, background: withAlpha(colors.fortune.blessing, 0.12), color: colors.fortune.blessing }}>
                                        ★ 祈福
                                    </div>
                                    {selectedBlessings.map(blessing => (
                                        <div
                                            key={`blessing-${blessing.id}`}
                                            style={todoItemStyle}
                                            onClick={() => blessing.id && toggleBlessing(blessing.id)}
                                        >
                                            <div style={{
                                                ...checkboxStyle,
                                                marginTop: '2px',
                                                background: blessing.completed ? withAlpha(colors.white, 0.85) : 'transparent',
                                                borderColor: blessing.completed ? withAlpha(colors.white, 0.85) : withAlpha(colors.white, 0.25),
                                            }}>
                                                {blessing.completed && <span style={{ color: colors.brand.dark, fontSize: '12px', fontWeight: fontWeight.bold }}>✓</span>}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    fontSize: fontSize.base,
                                                    color: blessing.completed ? withAlpha(colors.white, 0.3) : withAlpha(colors.white, 0.85),
                                                    textDecoration: blessing.completed ? 'line-through' : 'none',
                                                    textDecorationColor: withAlpha(colors.white, 0.3),
                                                }}>
                                                    {blessing.item}
                                                </span>
                                                {blessing.reason && (
                                                    <span style={blessingReasonStyle}>{blessing.reason}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* 分类待办分组 */}
                            {todoByCategoryEntries.map(({ meta, items }) => (
                                <div key={meta.label} style={todoGroupStyle}>
                                    <div style={{ ...categoryTagStyle, background: withAlpha(meta.color, 0.12), color: meta.color }}>
                                        {meta.icon} {meta.label}
                                    </div>
                                    {items.map(todo => (
                                        <div
                                            key={todo.id}
                                            style={todoItemStyle}
                                            onClick={() => toggleTodo(todo.id)}
                                        >
                                            <div style={{
                                                ...checkboxStyle,
                                                marginTop: '2px',
                                                background: todo.completed ? withAlpha(colors.white, 0.85) : 'transparent',
                                                borderColor: todo.completed ? withAlpha(colors.white, 0.85) : withAlpha(colors.white, 0.25),
                                            }}>
                                                {todo.completed && <span style={{ color: colors.brand.dark, fontSize: '12px', fontWeight: fontWeight.bold }}>✓</span>}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    fontSize: fontSize.base,
                                                    color: todo.completed ? withAlpha(colors.white, 0.3) : withAlpha(colors.white, 0.85),
                                                    textDecoration: todo.completed ? 'line-through' : 'none',
                                                    textDecorationColor: withAlpha(colors.white, 0.3),
                                                }}>
                                                    {todo.item}
                                                </span>
                                                <span style={todoReasonStyle}>{todo.reason}</span>
                                                {todo.time && (
                                                    <span style={todoTimeStyle}>{todo.time}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ─── Styles ─── */

const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    paddingTop: `${spacing.xl}px`,
    paddingLeft: '64px',
    paddingRight: '64px',
    paddingBottom: 0,
    gap: `${spacing.xl}px`,
    overflow: 'hidden',
    position: 'relative',
}

const calendarPanelStyle: React.CSSProperties = {
    flex: 1.2,
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.sm}px`,
    minWidth: 0,
    paddingBottom: `${spacing.lg}px`,
}

const todoPanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.md}px`,
    minWidth: 0,
    overflow: 'hidden',
}

const monthNavStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${spacing.xs}px`,
}

const navBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: colors.text.secondary,
    fontSize: '32px',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    padding: 0,
}

const monthLabelStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    letterSpacing: '1px',
}

const weekHeaderStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
}

const weekHeaderCellStyle: React.CSSProperties = {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.text.muted,
    fontWeight: fontWeight.medium,
    padding: `4px 0`,
}

const calendarGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    flex: 1,
}

const dayCellBase: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 0',
    gap: '2px',
    borderRadius: radius.sm,
    cursor: 'pointer',
    border: '1px solid transparent',
    minHeight: 0,
}

const calTodoDotStyle: React.CSSProperties = {
    width: '5px',
    height: '5px',
    borderRadius: radius.full,
    flexShrink: 0,
}

const calendarMarkerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    marginTop: '1px',
    height: '10px',
}

const calBlessingStarStyle: React.CSSProperties = {
    fontSize: '10px',
    color: colors.fortune.blessing,
    lineHeight: 1,
}

const todoTitleStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    margin: 0,
    letterSpacing: '0.5px',
}

const todoListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.sm}px`,
    paddingBottom: `${spacing.xl}px`,
}

const todoGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
}

const categoryTagStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    padding: '4px 10px',
    borderRadius: radius.full,
    letterSpacing: '0.5px',
}

const todoItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: `${spacing.sm}px`,
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: withAlpha(colors.white, 0.04),
    border: `1px solid ${withAlpha(colors.white, 0.08)}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    transition: 'background 0.15s',
}

const checkboxStyle: React.CSSProperties = {
    width: '22px',
    height: '22px',
    borderRadius: radius.xs,
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
}

const todoTimeStyle: React.CSSProperties = {
    display: 'block',
    fontSize: fontSize.xs,
    color: withAlpha(colors.white, 0.35),
    marginTop: '2px',
}

const todoReasonStyle: React.CSSProperties = {
    display: 'block',
    fontSize: fontSize.xs,
    color: withAlpha(colors.white, 0.48),
    marginTop: '4px',
    lineHeight: 1.5,
}

const blessingReasonStyle: React.CSSProperties = {
    display: 'block',
    fontSize: fontSize.xs,
    color: withAlpha(colors.white, 0.48),
    marginTop: '4px',
    lineHeight: 1.5,
}

const emptyStyle: React.CSSProperties = {
    color: colors.text.muted,
    fontSize: fontSize.base,
    textAlign: 'center',
    marginTop: `${spacing.xl}px`,
}
