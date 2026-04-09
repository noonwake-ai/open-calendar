import Dexie, { type EntityTable } from 'dexie'

export interface Conversation {
    id?: number
    conversationId: string
    title: string
    createdAt: number
    updatedAt: number
}

export interface Blessing {
    id?: number
    item: string
    reason?: string
    tag?: BlessingTag
    date: string // YYYY-MM-DD
    hexagramName: string
    question: string
    completed: boolean
    createdAt: number
}

export type BlessingTag = 'love' | 'wealth' | 'study' | 'career'

export interface BlessingInput {
    item: string
    reason?: string
    tag?: BlessingTag
    date: string
}

export interface ReportCache {
    id?: number
    cacheKey: string // e.g. "fortune:love:2026-04-04" or "specialday:甲庚冲:2026-04-04"
    reportJson: string // JSON stringified report data
    createdAt: number
}

const db = new Dexie('PiDemoDB') as Dexie & {
    conversations: EntityTable<Conversation, 'id'>
    blessings: EntityTable<Blessing, 'id'>
    reportCache: EntityTable<ReportCache, 'id'>
}

db.version(1).stores({
    conversations: '++id, &conversationId, updatedAt',
})

db.version(2).stores({
    conversations: '++id, &conversationId, updatedAt',
    blessings: '++id, date, createdAt',
})

db.version(3).stores({
    conversations: '++id, &conversationId, updatedAt',
    blessings: '++id, date, createdAt',
    reportCache: '++id, &cacheKey, createdAt',
})

export async function saveConversation(conversationId: string, title?: string): Promise<void> {
    const now = Date.now()
    const existing = await db.conversations.where('conversationId').equals(conversationId).first()
    if (existing) {
        await db.conversations.update(existing.id!, {
            updatedAt: now,
            ...(title ? { title } : {}),
        })
    } else {
        await db.conversations.add({
            conversationId,
            title: title || '新对话',
            createdAt: now,
            updatedAt: now,
        })
    }
}

export async function listConversations(): Promise<Conversation[]> {
    return db.conversations.orderBy('updatedAt').reverse().toArray()
}

export async function deleteConversation(conversationId: string): Promise<void> {
    await db.conversations.where('conversationId').equals(conversationId).delete()
}

// ========== Blessings ==========

export function formatBlessingSummary(blessing: Pick<BlessingInput, 'item' | 'reason'>): string {
    const reason = blessing.reason?.trim()
    return reason ? `${blessing.item}｜${reason}` : blessing.item
}

export async function saveBlessings(blessings: BlessingInput[], hexagramName: string, question: string): Promise<void> {
    const now = Date.now()
    const records: Blessing[] = blessings.map(b => ({
        item: b.item,
        reason: b.reason?.trim() || undefined,
        tag: b.tag,
        date: b.date,
        hexagramName,
        question,
        completed: false,
        createdAt: now,
    }))
    await db.blessings.bulkAdd(records)
}

export async function listBlessingsByDate(date: string): Promise<Blessing[]> {
    return db.blessings.where('date').equals(date).toArray()
}

export async function listAllBlessings(): Promise<Blessing[]> {
    return db.blessings.orderBy('date').toArray()
}

export async function toggleBlessingCompleted(id: number): Promise<void> {
    const blessing = await db.blessings.get(id)
    if (blessing) {
        await db.blessings.update(id, { completed: !blessing.completed })
    }
}

export async function clearAllBlessings(): Promise<void> {
    await db.blessings.clear()
}

export async function getBlessingDates(): Promise<Set<string>> {
    const all = await db.blessings.toArray()
    return new Set(all.filter(b => !b.completed).map(b => b.date))
}

// ========== Report Cache ==========

function getTodayDateStr(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getReportCache<T>(kind: string, typeKey: string): Promise<T | null> {
    const cacheKey = `${kind}:${typeKey}:${getTodayDateStr()}`
    const record = await db.reportCache.where('cacheKey').equals(cacheKey).first()
    if (!record) return null
    try {
        return JSON.parse(record.reportJson) as T
    } catch {
        return null
    }
}

export async function clearAllReportCache(): Promise<void> {
    await db.reportCache.clear()
}

export async function saveReportCache(kind: string, typeKey: string, data: unknown): Promise<void> {
    const cacheKey = `${kind}:${typeKey}:${getTodayDateStr()}`
    const existing = await db.reportCache.where('cacheKey').equals(cacheKey).first()
    if (existing) {
        await db.reportCache.update(existing.id!, { reportJson: JSON.stringify(data), createdAt: Date.now() })
    } else {
        await db.reportCache.add({ cacheKey, reportJson: JSON.stringify(data), createdAt: Date.now() })
    }
}

export default db
