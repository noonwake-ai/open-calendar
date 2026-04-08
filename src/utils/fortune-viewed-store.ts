/**
 * 缓存当天已查看的运势类型的 tags，按日期隔离（跨天自动失效）
 */

const STORAGE_KEY = 'pi_fortune_viewed'

interface FortuneViewedData {
    date: string // "YYYY-MM-DD"
    tags: Record<string, [string, string, string]>
}

function getTodayKey(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function load(): FortuneViewedData {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as FortuneViewedData
            if (parsed.date === getTodayKey()) return parsed
        }
    } catch {}
    return { date: getTodayKey(), tags: {} }
}

export function saveFortuneViewedTags(type: string, tags: [string, string, string]): void {
    const data = load()
    data.tags[type] = tags
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getFortuneViewedTags(type: string): [string, string, string] | null {
    return load().tags[type] ?? null
}

export function getAllFortuneViewedTags(): Record<string, [string, string, string]> {
    return load().tags
}
