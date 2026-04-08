/**
 * 全局用户信息管理
 * 登录后获取并缓存用户信息
 */
import { callApi } from './api'
import { apis } from './api'
import type { User } from '../domain/types'
import { getDeviceToken } from './device'

let currentUser: User | null = null

export function getUser(): User | null {
    return currentUser
}

export function getUserId(): string {
    return currentUser?.user_id ?? ''
}

/** 登录成功后调用，获取并缓存用户信息 */
export async function fetchUserInfo(): Promise<User | null> {
    if (!getDeviceToken()) return null
    try {
        const info = await callApi(apis.mina.user.getUserInfo, undefined as any)
        currentUser = info?.user ?? null
        return currentUser
    } catch (e) {
        console.error('获取用户信息失败:', e)
        return null
    }
}

/** 清除缓存（登出时调用） */
export function clearUser(): void {
    currentUser = null
}
