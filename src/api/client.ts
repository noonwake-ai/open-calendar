/**
 * API 客户端 — 替代 monorepo 的 CommonApi 泛型体系
 *
 * 核心行为：
 * 1. configPromise 去重（由 runtime.ts 独占）
 * 2. window.APP_CONFIG 缓存（由 runtime.ts 独占）
 * 3. 统一解析 { data, error } 响应
 * 4. 自动注入 Authorization header
 */
import axios from 'axios'
import { getAppConfig } from '../config/runtime'
import type { ApiDef } from './contracts'

// Reason: getDeviceToken 在 Commit 4 迁移 utils/device.ts 后替换为真实实现
let _getDeviceToken: () => string | null = () => localStorage.getItem('device_token')

export function setDeviceTokenGetter(getter: () => string | null) {
    _getDeviceToken = getter
}

type ApiResp<T> = { data?: T; error?: { code?: number; msg: string } }

/**
 * 调用后端 API
 */
export async function callApi<REQ, RESP>(
    api: ApiDef<REQ, RESP>,
    params: REQ,
): Promise<RESP> {
    const config = await getAppConfig()
    const baseURL = config.BASE_URL

    const resp = await axios.post<ApiResp<RESP>>(api.path, params, {
        baseURL,
        headers: { Authorization: _getDeviceToken() ?? '' },
    })

    const body = resp.data
    if (body?.error) {
        console.error('API Error:', body.error.msg)
        throw body.error
    }
    return body.data as RESP
}
