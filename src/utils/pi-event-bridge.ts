import { getAppConfig } from '../config/runtime'

// Reason: 事件名格式 pi:${kind}.${action}，业务层直接 addEventListener 消费
type PiEventKind = 'wake' | 'record' | 'shake'
type PiEventAction = 'trigger' | 'start' | 'stop'

interface PiStateResponse {
    ok: boolean
    recording: boolean
    latest: {
        seq: number
        ts: string
        kind: PiEventKind
        action: PiEventAction
    }
}

interface PiEventEntry {
    seq: number
    ts: string
    kind: PiEventKind
    action: PiEventAction
}

const POLL_INTERVAL = 500
const WARN_THROTTLE = 30_000

let timer: ReturnType<typeof setInterval> | null = null
let lastSeq = -1
let baseUrl = ''
let lastWarnTime = 0
let inFlight = false

function dispatchPiEvent(kind: PiEventKind, action: PiEventAction): void {
    window.dispatchEvent(new CustomEvent(`pi:${kind}.${action}`))
}

// Reason: seq 跳变 > 1 说明一个轮询周期内发生了多个事件（如快速 record.start→stop）
// 补拉 /events 回放丢失的事件，避免前端只看到最后一个
// 返回 true 表示成功回放，false 表示失败需要兜底
async function replayMissedEvents(fromSeq: number, toSeq: number): Promise<boolean> {
    try {
        const resp = await fetch(`${baseUrl}/events`)
        if (!resp.ok) return false
        const events: PiEventEntry[] = await resp.json()
        // Reason: /events 返回全部历史，只取 fromSeq < seq <= toSeq 范围内的事件按序回放
        const missed = events
            .filter(e => e.seq > fromSeq && e.seq <= toSeq)
            .sort((a, b) => a.seq - b.seq)
        for (const e of missed) {
            dispatchPiEvent(e.kind, e.action)
        }
        return true
    } catch {
        return false
    }
}

async function poll(): Promise<void> {
    // Reason: 防止异步请求并发——上一次 poll 还没返回时跳过本次
    if (inFlight) return
    inFlight = true
    try {
        const resp = await fetch(`${baseUrl}/state`)
        if (!resp.ok) return
        const data: PiStateResponse = await resp.json()
        if (!data.latest) return // Reason: bridge 刚启动还没有任何按键事件时 latest 为 null
        const { seq, kind, action } = data.latest

        if (lastSeq === -1) {
            // Reason: 首次轮询只记录 seq，不触发事件，避免启动时误触发 bridge 上残留的旧事件
            lastSeq = seq
            return
        }

        // Reason: 单调性保护——旧请求晚归时 seq 可能比 lastSeq 小，直接丢弃
        if (seq <= lastSeq) return

        const gap = seq - lastSeq
        if (gap > 1) {
            // Reason: 跳变 > 1，有丢失事件，补拉 /events 按序回放
            const ok = await replayMissedEvents(lastSeq, seq)
            if (!ok) {
                // Reason: 补拉失败时退化为只处理 latest，确保不会静默丢弃
                dispatchPiEvent(kind, action)
            }
        } else {
            dispatchPiEvent(kind, action)
        }

        lastSeq = seq
    } catch {
        const now = Date.now()
        if (now - lastWarnTime > WARN_THROTTLE) {
            lastWarnTime = now
            console.warn('[pi-event-bridge] 连接失败，bridge 可能未启动')
        }
    } finally {
        inFlight = false
    }
}

export function startPiEventBridge(): void {
    if (timer) return
    getAppConfig().then(config => {
        const url = config.PI_EVENT_BRIDGE_URL
        if (!url) return
        baseUrl = url.replace(/\/$/, '')
        timer = setInterval(poll, POLL_INTERVAL)
        // Reason: 立即执行一次，记录初始 seq，不等第一个 500ms
        poll()
    }).catch(() => {
        // Reason: 配置加载失败 → bridge 不启动，不影响主应用
    })
}

export function stopPiEventBridge(): void {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
}
