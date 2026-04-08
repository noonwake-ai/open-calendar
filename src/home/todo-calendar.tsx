import React, { ReactElement, useEffect, useState } from 'react'
import { paths } from '../router/urls'
import { useLocation } from 'react-router-dom'
import { colors, fontSize, fontWeight, radius, spacing, withAlpha } from '../styles/tokens'
import { SolarDay } from 'tyme4ts'
import BackButton from '../components/back-button'
import { Blessing, listAllBlessings, toggleBlessingCompleted } from '../utils/local-db'
import { buildTodoCategoryMap, TODO_CATEGORY_COLORS, getTodoCategory, TodoCategoryKey } from './todo-meta'

const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六']

const CATEGORY_META: Record<TodoCategoryKey, { icon: string; label: string; color: string }> = {
    love:    { icon: '♥', label: '桃花', color: TODO_CATEGORY_COLORS.love },
    career:  { icon: '❖', label: '事业', color: TODO_CATEGORY_COLORS.career },
    wealth:  { icon: '¥', label: '财运', color: TODO_CATEGORY_COLORS.wealth },
    study:   { icon: '✎', label: '学业', color: TODO_CATEGORY_COLORS.study },
}

export interface TodoItem {
    id: string
    text: string
    time?: string
    completed: boolean
    date: string // "YYYY-MM-DD"
}

// Mock data - will be replaced by AI-generated content based on user birth fortune
export const INITIAL_TODOS: TodoItem[] = [
    // 4月1日
    { id: '1',  text: '晨起冥想，调和今日气场', time: '07:00', completed: false, date: '2026-04-01' },
    { id: '3',  text: '午后避免重大财务决策', time: '13:00', completed: true, date: '2026-04-01' },
    // 4月3日
    { id: '5',  text: '整理工作桌面，理顺气场', time: '09:00', completed: true, date: '2026-04-03' },
    { id: '6',  text: '下午适合处理财务事项', time: '14:00', completed: false, date: '2026-04-03' },
    // 4月5日
    { id: '7',  text: '晚间适合学习新技能', time: '20:00', completed: false, date: '2026-04-05' },
    { id: '8',  text: '静心阅读，提升文昌运', completed: false, date: '2026-04-05' },
    // 4月9日
    { id: '9',  text: '查阅投资资讯，把握财机', time: '10:00', completed: false, date: '2026-04-09' },
    // 4月11日（桃花 × 2）
    { id: '10', text: '约见心仪之人，主动表达心意', time: '14:00', completed: false, date: '2026-04-11' },
    { id: '11', text: '精心打扮，提升个人魅力', completed: false, date: '2026-04-11' },
    { id: '12', text: '下午复习近期学习内容', time: '15:00', completed: false, date: '2026-04-11' },
    // 4月14日
    { id: '13', text: '拜访长辈，增进家庭感情', time: '11:00', completed: false, date: '2026-04-14' },
    // 4月18日
    { id: '14', text: '练习书法或绘画，养心性', time: '10:00', completed: false, date: '2026-04-18' },
    { id: '15', text: '傍晚与伴侣共进晚餐', time: '18:30', completed: false, date: '2026-04-18' },
    // 4月22日
    { id: '2',  text: '佩戴红色饰品增强桃花运', completed: false, date: '2026-04-22' },
    { id: '4',  text: '傍晚适合与家人聚餐', time: '18:00', completed: false, date: '2026-04-22' },
    { id: '16', text: '专注学习一项新技能', time: '10:00', completed: false, date: '2026-04-22' },
    // 4月26日
    { id: '17', text: '制定下月事业规划', time: '09:30', completed: false, date: '2026-04-26' },
    { id: '18', text: '理顺近期财务账目', time: '16:00', completed: false, date: '2026-04-26' },
    // 5月4日
    { id: '19', text: '阅读专业书籍，充实学业', time: '10:00', completed: false, date: '2026-05-04' },
    // 5月8日
    { id: '20', text: '研究新理财方向，谨慎决策', time: '10:00', completed: false, date: '2026-05-08' },
    { id: '21', text: '与同事协作，推进项目', time: '14:00', completed: false, date: '2026-05-08' },
    // 5月13日
    { id: '22', text: '精心准备浪漫约会', time: '18:00', completed: false, date: '2026-05-13' },
    // 4月9日（补充财运）
    { id: '23', text: '整理近月收支账目，把握消费节奏', time: '15:00', completed: false, date: '2026-04-09' },
    // 4月22日（补充财运）
    { id: '24', text: '关注投资动态，避免冲动消费', time: '11:00', completed: false, date: '2026-04-22' },
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
        const items = selectedTodos.filter(t => getTodoCategory(t.text) === key)
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
                                                    {todo.text}
                                                </span>
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

const emptyStyle: React.CSSProperties = {
    color: colors.text.muted,
    fontSize: fontSize.base,
    textAlign: 'center',
    marginTop: `${spacing.xl}px`,
}
