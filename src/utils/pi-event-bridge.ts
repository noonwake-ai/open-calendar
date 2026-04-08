import { getAppConfig } from '../config/runtime'

type PiEventKind = 'wake' | 'record' | 'shake'
type PiEventAction = 'trigger' | 'start' | 'stop'

interface PiEvent {
    seq: number
    ts: string
    kind: PiEventKind
    action: PiEventAction
    text?: string
    [key: string]: unknown
}

interface PiEventsResponse {
    ok: boolean
    events: PiEvent[]
    latest_seq: number
    overflow: boolean
    startedAt: string
}

interface PiStateResponse {
    ok: boolean
    latest: { seq: number } | null
    startedAt: string
}

const POLL_INTERVAL = 500
const WARN_THROTTLE = 30_000

let timer: ReturnType<typeof setTimeout> | null = null
let lastSeq = -1
let baseUrl = ''
let bridgeStartedAt = ''
let lastWarnTime = 0

function dispatchPiEvent(event: PiEvent): void {
    // Reason: CustomEvent 带完整 detail，方便消费方按需读取字段（如 shake.text）
    window.dispatchEvent(new CustomEvent(`pi:${event.kind}.${event.action}`, { detail: event }))
}

// Reason: 从 /state 获取初始 seq 和 startedAt，不 dispatch 事件
async function initialize(): Promise<boolean> {
    try {
        const resp = await fetch(`${baseUrl}/state?limit=0`)
        if (!resp.ok) return false
        const data: PiStateResponse = await resp.json()
        lastSeq = data.latest?.seq ?? 0
        bridgeStartedAt = data.startedAt
        return true
    } catch {
        return false
    }
}

async function poll(): Promise<void> {
    try {
        const resp = await fetch(`${baseUrl}/events?after_seq=${lastSeq}`)
        if (!resp.ok) return
        const data: PiEventsResponse = await resp.json()

        // Reason: 服务重启后 seq 回零，或 overflow 说明事件已被淘汰——需要重同步
        const needResync = data.overflow
            || data.latest_seq < lastSeq
            || (bridgeStartedAt && data.startedAt !== bridgeStartedAt)

        if (needResync) {
            await initialize()
            return
        }

        // Reason: 按 seq 升序逐条 dispatch，确保消费方收到完整有序事件流
        for (const event of data.events) {
            dispatchPiEvent(event)
        }

        if (data.events.length > 0) {
            lastSeq = data.events[data.events.length - 1].seq
        }
        bridgeStartedAt = data.startedAt
    } catch {
        const now = Date.now()
        if (now - lastWarnTime > WARN_THROTTLE) {
            lastWarnTime = now
            console.warn('[pi-event-bridge] 连接失败，bridge 可能未启动')
        }
    }
}

// Reason: 递归 setTimeout 天然防并发——上一次 poll 完成后才调度下一次
function scheduleNext(): void {
    timer = setTimeout(async () => {
        await poll()
        if (timer !== null) scheduleNext()
    }, POLL_INTERVAL)
}

export function startPiEventBridge(): void {
    if (timer !== null) return
    getAppConfig().then(async config => {
        const url = config.PI_EVENT_BRIDGE_URL
        if (!url) return
        baseUrl = url.replace(/\/$/, '')
        await initialize()
        scheduleNext()
    }).catch(() => {
        // Reason: 配置加载失败 → bridge 不启动，不影响主应用
    })
}

export function stopPiEventBridge(): void {
    if (timer !== null) {
        clearTimeout(timer)
        timer = null
    }
    lastSeq = -1
    baseUrl = ''
    bridgeStartedAt = ''
    lastWarnTime = 0
}
