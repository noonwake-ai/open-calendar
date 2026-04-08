/**
 * 全局八字信息管理
 * 登录后获取用户活跃八字，每 10 秒轮询更新
 */
import { callApi } from './api'
import { apis } from './api'
import type { Bazi } from '../domain/types'
import baziHelpers from '../common/helpers/bazi-helpers'
import { dateTimeWuxing } from '../common/utils'
import { getDeviceToken } from './device'

type BaziListener = (bazi: Bazi | null) => void

let activeBazi: Bazi | null = null
let baziInfoStr: string = ''
let pollTimer: ReturnType<typeof setInterval> | null = null
const listeners: Set<BaziListener> = new Set()

function notifyListeners() {
    for (const listener of listeners) {
        listener(activeBazi)
    }
}

async function fetchActiveBazi(): Promise<void> {
    if (!getDeviceToken()) return
    try {
        const bazi = await callApi(apis.mina.bazi.getActive, undefined as any)
        activeBazi = bazi ?? null
        baziInfoStr = activeBazi ? baziHelpers.getBaziInfo(activeBazi) : ''
        notifyListeners()
    } catch (e) {
        console.error('获取八字信息失败:', e)
    }
}

/** 启动轮询（登录成功后调用） */
export function startBaziPolling(): void {
    // 立即获取一次
    fetchActiveBazi()
    // 每 10 秒轮询
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(fetchActiveBazi, 10_000)
}

/** 停止轮询（登出时调用） */
export function stopBaziPolling(): void {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
    activeBazi = null
    baziInfoStr = ''
}

/** 获取当前活跃八字原始数据 */
export function getActiveBazi(): Bazi | null {
    return activeBazi
}

/** 获取格式化的八字信息字符串（用于 Dify inputs） */
export function getBaziInfoStr(): string {
    return baziInfoStr
}

/** 获取当前时间的干支五行字符串（用于 Dify current_time） */
export function getCurrentTimeWuxing(): string {
    return dateTimeWuxing(Date.now())
}

/** 订阅八字变化 */
export function onBaziChange(listener: BaziListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
