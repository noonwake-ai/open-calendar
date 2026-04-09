import { getAppConfig } from '../config/runtime'

export type ProjectionChannelMsg =
    | { type: 'trigger_scene'; scene: 'sleep' | 'interpret' | 'casting' | 'idle' | 'wake'; tts_content?: string }

type ProjectionEventEntry = {
    seq: number
    ts: string
    message: ProjectionChannelMsg
}

type ProjectionStateResponse = {
    ok: boolean
    latest: ProjectionEventEntry | null
    latest_seq: number
    startedAt: string
}

type ProjectionEventsResponse = {
    ok: boolean
    events: ProjectionEventEntry[]
    latest_seq: number
    overflow: boolean
    startedAt: string
}

const CHANNEL_NAME = 'pi-projection'
const POLL_INTERVAL_MS = 500

let bridgeUrlPromise: Promise<string> | null = null

async function getProjectionBridgeUrl(): Promise<string> {
    if (!bridgeUrlPromise) {
        bridgeUrlPromise = getAppConfig()
            .then(config => (config.PI_EVENT_BRIDGE_URL ?? '').replace(/\/$/, ''))
            .catch(() => {
                bridgeUrlPromise = null
                return ''
            })
    }
    return bridgeUrlPromise
}

function postByBroadcastChannel(msg: ProjectionChannelMsg): void {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    ch.postMessage(msg)
    ch.close()
}

export function sendProjectionMessage(msg: ProjectionChannelMsg): void {
    void getProjectionBridgeUrl().then(async baseUrl => {
        if (!baseUrl) {
            postByBroadcastChannel(msg)
            return
        }

        try {
            const resp = await fetch(`${baseUrl}/projection/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, source: 'frontend' }),
                keepalive: true,
                mode: 'cors',
            })
            if (!resp.ok) throw new Error(`projection bridge http ${resp.status}`)
        } catch {
            postByBroadcastChannel(msg)
        }
    })
}

export function listenProjectionChannel(
    handler: (msg: ProjectionChannelMsg) => void,
): () => void {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastSeq = -1
    let bridgeStartedAt = ''

    let stop = () => {
        disposed = true
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
    }

    void getProjectionBridgeUrl().then(async baseUrl => {
        if (disposed) return
        if (!baseUrl) {
            const ch = new BroadcastChannel(CHANNEL_NAME)
            ch.onmessage = (e: MessageEvent<ProjectionChannelMsg>) => handler(e.data)
            const prevStop = stop
            const stopBroadcast = () => {
                ch.close()
                prevStop()
            }
            stop = stopBroadcast
            return
        }

        const initialize = async () => {
            try {
                const resp = await fetch(`${baseUrl}/projection/state`)
                if (!resp.ok) return
                const data: ProjectionStateResponse = await resp.json()
                if (disposed) return
                lastSeq = data.latest_seq
                bridgeStartedAt = data.startedAt
            } catch {
                // Reason: 投影端 bridge 初始化失败时静默重试，避免影响页面渲染
            }
        }

        const scheduleNext = () => {
            if (disposed) return
            timer = setTimeout(async () => {
                try {
                    if (lastSeq < 0) {
                        await initialize()
                    } else {
                        const resp = await fetch(`${baseUrl}/projection/events?after_seq=${lastSeq}`)
                        if (resp.ok) {
                            const data: ProjectionEventsResponse = await resp.json()
                            const needResync = data.overflow
                                || data.latest_seq < lastSeq
                                || (bridgeStartedAt && data.startedAt !== bridgeStartedAt)
                            if (needResync) {
                                await initialize()
                            } else {
                                for (const event of data.events) handler(event.message)
                                if (data.events.length > 0) {
                                    lastSeq = data.events[data.events.length - 1].seq
                                }
                                bridgeStartedAt = data.startedAt
                            }
                        }
                    }
                } catch {
                    // Reason: bridge 短暂不可用时保持轮询，等待服务恢复
                } finally {
                    scheduleNext()
                }
            }, POLL_INTERVAL_MS)
        }

        await initialize()
        scheduleNext()
    })

    return () => stop()
}
