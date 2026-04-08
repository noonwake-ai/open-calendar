/**
 * API 契约定义 — 本地定义，不依赖 monorepo
 *
 * 每个 API 只声明路径、请求参数类型和响应数据类型。
 * 运行时通过 client.ts 的 callApi() 调用。
 */
import type { Bazi, UserInfo } from '../domain/types'
import type { DailyFortuneType, SpecialDayCategory, T_DAILY_FORTUNE } from '../domain/fortune'

// ── API 定义结构 ─────────────────────────────────────────

export interface ApiDef<REQ, RESP> {
    path: string
    _req?: REQ   // phantom type，仅用于类型推断
    _resp?: RESP // phantom type
}

function def<REQ, RESP>(path: string): ApiDef<REQ, RESP> {
    return { path }
}

// ── PI 认证 ──────────────────────────────────────────────

export const piAuth = {
    createSession: def<void, { session_id: string; expires_at: number }>(
        '/pi/auth/create_session'
    ),
    pollSession: def<{ session_id: string }, { status: 'pending' | 'confirmed' | 'expired'; token?: string }>(
        '/pi/auth/poll_session'
    ),
}

// ── PI 首页 ──────────────────────────────────────────────

export const piHome = {
    today: def<void, {
        date: { solar: string; lunar: string; ganzhi: string }
        tengod: { tengodId: string; shiShen: string; name: string } | null
        dailyFortune: T_DAILY_FORTUNE | null
        specialDays: Array<{
            category: SpecialDayCategory
            data: {
                dayName?: string
                term?: string
                relation?: string
                interpretation: string
                emotion: string
                keywords: string
            }
        }>
        user: { nickname: string; avatar: string } | null
    }>('/pi/home/today'),
}

// ── 用户 ─────────────────────────────────────────────────

export const minaUser = {
    getUserInfo: def<{ deviceInfo?: any } | undefined, UserInfo | undefined>(
        '/mina/user/getUserInfo'
    ),
    sendPhoneVerifyCode: def<{ phone: string }, void>(
        '/mina/user/sendPhoneVerifyCode'
    ),
    verifyPhoneVerifyCode: def<{ phone: string; verifyCode: string }, UserInfo>(
        '/mina/user/verifyPhoneVerifyCode'
    ),
}

// ── 八字 ─────────────────────────────────────────────────

export const minaBazi = {
    getActive: def<void, Bazi | undefined>(
        '/mina/bazi/get_active'
    ),
}
