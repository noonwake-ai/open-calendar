import { colors } from '../styles/tokens'

export const TODO_CATEGORY_COLORS = {
    love: colors.fortune.love,
    career: colors.fortune.career,
    wealth: colors.fortune.wealth,
    study: colors.fortune.study,
} as const

export const BLESSING_COLOR = colors.fortune.blessing

export type TodoCategoryKey = keyof typeof TODO_CATEGORY_COLORS

interface TodoCategorySource {
    item?: string
    tag?: TodoCategoryKey
    date: string
    completed: boolean
}

export function getTodoCategory(text: string): TodoCategoryKey {
    if (/(桃花|家人|感情|约会|饰品|聚餐|心仪|打扮|魅力|约见|伴侣|浪漫|恋|情侣)/.test(text)) return 'love'
    if (/(财|理财|金|决策|收支|消费|投资|账目|结算)/.test(text)) return 'wealth'
    if (/(学习|阅读|文昌|技能|冥想|书法|绘画|书籍|复习|笔记|古籍|课程)/.test(text)) return 'study'
    return 'career'
}

export function buildTodoCategoryMap(items: TodoCategorySource[]): Map<string, TodoCategoryKey[]> {
    const todoCategoryMap = new Map<string, TodoCategoryKey[]>()

    for (const item of items) {
        if (item.completed) continue
        const category = item.tag ?? getTodoCategory(item.item ?? '')
        const categories = todoCategoryMap.get(item.date) ?? []
        if (!categories.includes(category)) categories.push(category)
        todoCategoryMap.set(item.date, categories)
    }

    return todoCategoryMap
}
