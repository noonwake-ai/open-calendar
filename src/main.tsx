import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router/router'
import { reportPiEventConsumerLog, startPiEventBridge, stopPiEventBridge } from './utils/pi-event-bridge'
import { sendProjectionMessage } from './utils/projection-channel'
import { paths } from './router/urls'
import './index.scss'
import './common/utils/array-extensions'

// Reason: 投影屏（/projection）是独立 Chromium 窗口，共享同一 main.tsx 入口
// 只有主屏需要轮询 bridge 和处理事件，避免双窗口重复轮询/重复触发
// Reason: 归一化尾斜杠，避免 /pi/projection/ 和 /pi/projection 不匹配
const stripTrailingSlash = (p: string) => p.replace(/\/+$/, '') || ''
const basePath = stripTrailingSlash(import.meta.env.BASE_URL)
const isProjection = stripTrailingSlash(window.location.pathname) === `${basePath}${paths.projection}`
const BRIDGE_OWNER_KEY = 'pi-bridge-owner'
const BRIDGE_OWNER_TS_KEY = 'pi-bridge-owner-ts'
const BRIDGE_HEARTBEAT_MS = 1000
const BRIDGE_STALE_MS = 3000
const bridgeWindowId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
let bridgeActive = false
let bridgeHeartbeatTimer: ReturnType<typeof setInterval> | null = null

function onWakeTrigger(event: Event) {
    const detail = event instanceof CustomEvent ? event.detail : undefined
    reportPiEventConsumerLog('consumer:main', 'wake.trigger', detail)
    sendProjectionMessage({ type: 'trigger_scene', scene: 'wake' })
}

function nowMs(): number {
    return Date.now()
}

function readBridgeOwner(): { owner: string | null, ts: number } {
    const owner = window.localStorage.getItem(BRIDGE_OWNER_KEY)
    const tsRaw = window.localStorage.getItem(BRIDGE_OWNER_TS_KEY)
    const ts = tsRaw ? Number(tsRaw) : 0
    return { owner, ts: Number.isFinite(ts) ? ts : 0 }
}

function writeBridgeOwner(owner: string): void {
    const ts = String(nowMs())
    window.localStorage.setItem(BRIDGE_OWNER_KEY, owner)
    window.localStorage.setItem(BRIDGE_OWNER_TS_KEY, ts)
}

function releaseBridgeOwner(): void {
    const { owner } = readBridgeOwner()
    if (owner !== bridgeWindowId) return
    window.localStorage.removeItem(BRIDGE_OWNER_KEY)
    window.localStorage.removeItem(BRIDGE_OWNER_TS_KEY)
}

function syncBridgeLeadership(): void {
    const { owner, ts } = readBridgeOwner()
    const stale = !owner || nowMs() - ts > BRIDGE_STALE_MS
    const shouldOwn = owner === bridgeWindowId || stale

    if (shouldOwn) {
        writeBridgeOwner(bridgeWindowId)
        if (!bridgeActive) {
            startPiEventBridge()
            window.addEventListener('pi:wake.trigger', onWakeTrigger)
            bridgeActive = true
            reportPiEventConsumerLog('consumer:main', 'bridge.leader.acquired', { bridgeWindowId })
        }
        return
    }

    if (bridgeActive) {
        stopPiEventBridge()
        window.removeEventListener('pi:wake.trigger', onWakeTrigger)
        bridgeActive = false
        reportPiEventConsumerLog('consumer:main', 'bridge.leader.released', { bridgeWindowId, owner })
    }
}

function onBridgeOwnerStorage(event: StorageEvent): void {
    if (event.key === BRIDGE_OWNER_KEY || event.key === BRIDGE_OWNER_TS_KEY) {
        syncBridgeLeadership()
    }
}

function onBridgeBeforeUnload(): void {
    if (bridgeHeartbeatTimer !== null) {
        clearInterval(bridgeHeartbeatTimer)
        bridgeHeartbeatTimer = null
    }
    releaseBridgeOwner()
    if (bridgeActive) {
        stopPiEventBridge()
        window.removeEventListener('pi:wake.trigger', onWakeTrigger)
        bridgeActive = false
    }
}

if (!isProjection) {
    syncBridgeLeadership()
    bridgeHeartbeatTimer = setInterval(syncBridgeLeadership, BRIDGE_HEARTBEAT_MS)
    window.addEventListener('storage', onBridgeOwnerStorage)
    window.addEventListener('beforeunload', onBridgeBeforeUnload)
}

// Reason: HMR 时模块重新执行会累计监听器，dispose 清理上一轮的注册
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (bridgeHeartbeatTimer !== null) {
            clearInterval(bridgeHeartbeatTimer)
            bridgeHeartbeatTimer = null
        }
        window.removeEventListener('storage', onBridgeOwnerStorage)
        window.removeEventListener('beforeunload', onBridgeBeforeUnload)
        releaseBridgeOwner()
        stopPiEventBridge()
        window.removeEventListener('pi:wake.trigger', onWakeTrigger)
    })
}

const container = document.getElementById('root')
if (container) {
    createRoot(container).render(<RouterProvider router={router} />)
}
