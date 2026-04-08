/**
 * 兼容层 — 将旧 callApi(apis.xxx, params) 调用桥接到新 API client
 * Reason: PI 页面代码大量使用 callApi + apis 对象，此文件保持调用签名兼容，
 *         实际逻辑由 src/api/client.ts 和 src/config/runtime.ts 承担
 */
export { callApi } from '../api/client'
export { getAppConfig } from '../config/runtime'
export type { AppConfig } from '../config/runtime'

// Reason: 兼容 PI 页面中 `import { apis } from` 的写法
import * as piAuth from '../api/contracts'
import * as piHome from '../api/contracts'
import * as minaUser from '../api/contracts'
import * as minaBazi from '../api/contracts'

export const apis = {
    pi: {
        auth: piAuth.piAuth,
        home: piHome.piHome,
    },
    mina: {
        user: minaUser.minaUser,
        bazi: minaBazi.minaBazi,
    },
}
