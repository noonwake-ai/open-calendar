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
const DEV = import.meta.env.DEV

let timer: ReturnType<typeof setTimeout> | null = null
let lastSeq = -1
let baseUrl = ''
let bridgeStartedAt = ''
let lastWarnTime = 0
let stopped = false

type FrontendLogEntry = {
    ts: string
    scope: string
    message: string
    extra?: unknown
}

function sendFrontendLog(entry: FrontendLogEntry): void {
    if (!baseUrl) return
    void fetch(`${baseUrl}/frontend-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
        keepalive: true,
        mode: 'cors',
    }).catch(() => {
        // Reason: 日志上报失败不影响主流程
    })
}

function logBridge(message: string, extra?: unknown): void {
    if (DEV) {
        if (extra === undefined) console.info(`[pi-event-bridge] ${message}`)
        else console.info(`[pi-event-bridge] ${message}`, extra)
    }
    sendFrontendLog({ ts: new Date().toISOString(), scope: 'bridge', message, extra })
}

export function reportPiEventConsumerLog(scope: string, message: string, extra?: unknown): void {
    if (DEV) console.info(`[pi-event-bridge] ${scope} ${message}`, extra)
    sendFrontendLog({ ts: new Date().toISOString(), scope, message, extra })
}

function dispatchPiEvent(event: PiEvent): void {
    logBridge('dispatch', event)
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
        logBridge('initialized', { baseUrl, lastSeq, bridgeStartedAt })
        return true
    } catch {
        logBridge('initialize failed')
        return false
    }
}

async function poll(): Promise<void> {
    // Reason: 未初始化成功时 lastSeq=-1，不能直接打 /events，否则会回放历史事件
    if (lastSeq < 0) {
        await initialize()
        return
    }

    try {
        const resp = await fetch(`${baseUrl}/events?after_seq=${lastSeq}`)
        if (!resp.ok) return
        const data: PiEventsResponse = await resp.json()

        // Reason: 服务重启后 seq 回零，或 overflow 说明事件已被淘汰——需要重同步
        const needResync = data.overflow
            || data.latest_seq < lastSeq
            || (bridgeStartedAt && data.startedAt !== bridgeStartedAt)

        if (needResync) {
            logBridge('resync required', {
                lastSeq,
                latestSeq: data.latest_seq,
                overflow: data.overflow,
                startedAt: data.startedAt,
                bridgeStartedAt,
            })
            await initialize()
            return
        }

        if (data.events.length > 0) {
            logBridge('poll received events', {
                count: data.events.length,
                lastSeq,
                latestSeq: data.latest_seq,
                events: data.events,
            })
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
        // Reason: stopped 守卫防止异步链路返回后继续调度（HMR dispose 竞态）
        if (timer !== null && !stopped) scheduleNext()
    }, POLL_INTERVAL)
}

export function startPiEventBridge(): void {
    if (timer !== null) return
    stopped = false
    getAppConfig().then(async config => {
        // Reason: stop 可能在 getAppConfig 异步期间被调用，检查 stopped 防止继续
        if (stopped) return
        const url = config.PI_EVENT_BRIDGE_URL
        if (!url) return
        baseUrl = url.replace(/\/$/, '')
        logBridge('start requested', { baseUrl })
        await initialize()
        if (stopped) return
        scheduleNext()
    }).catch(() => {
        logBridge('config load failed, bridge not started')
    })
}

export function stopPiEventBridge(): void {
    stopped = true
    if (timer !== null) {
        clearTimeout(timer)
        timer = null
    }
    logBridge('stopped', { lastSeq, baseUrl, bridgeStartedAt })
    lastSeq = -1
    baseUrl = ''
    bridgeStartedAt = ''
    lastWarnTime = 0
}
