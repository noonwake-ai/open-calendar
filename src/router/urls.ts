export const paths = {
    index: '/',
    pairing: '/pairing',
    login: '/login',
    projection: '/projection',
    difyChatDemo: '/dify-chat-demo',
    doubaoRealtimeDemo: '/doubao-realtime-demo',
    home: {
        index: '/home',
        settings: '/home/settings',
        fortuneType: '/home/fortune-type/:fortuneType',
        specialDay: '/home/special-day',
        todo: '/home/todo',
        shake: '/home/shake',
    },
}

export function fortuneTypePath(type: string): string {
    return `/home/fortune-type/${type}`
}
