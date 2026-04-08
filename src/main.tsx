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

function onWakeTrigger(event: Event) {
    const detail = event instanceof CustomEvent ? event.detail : undefined
    reportPiEventConsumerLog('consumer:main', 'wake.trigger', detail)
    sendProjectionMessage({ type: 'trigger_scene', scene: 'wake' })
}

if (!isProjection) {
    startPiEventBridge()
    window.addEventListener('pi:wake.trigger', onWakeTrigger)
}

// Reason: HMR 时模块重新执行会累计监听器，dispose 清理上一轮的注册
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        stopPiEventBridge()
        window.removeEventListener('pi:wake.trigger', onWakeTrigger)
    })
}

const container = document.getElementById('root')
if (container) {
    createRoot(container).render(<RouterProvider router={router} />)
}
