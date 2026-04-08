export type ProjectionChannelMsg =
    | { type: 'trigger_scene'; scene: 'interpret' | 'casting' | 'idle' | 'wake'; tts_content?: string }

const CHANNEL_NAME = 'pi-projection'

export function sendProjectionMessage(msg: ProjectionChannelMsg): void {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    ch.postMessage(msg)
    ch.close()
}

export function listenProjectionChannel(
    handler: (msg: ProjectionChannelMsg) => void,
): () => void {
    const ch = new BroadcastChannel(CHANNEL_NAME)
    ch.onmessage = (e: MessageEvent<ProjectionChannelMsg>) => handler(e.data)
    return () => ch.close()
}
