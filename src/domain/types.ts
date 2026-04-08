/**
 * 本地域模型 — 从 monorepo common/models/table.ts 提取的最小子集
 * 只包含 PI 前端实际使用的字段和类型
 */

export type Int = number
export type Long = number
export type Float = number

// ── 用户 ────────────────────────────────────────────────

export enum UserGender {
    unknown = 2,
    male = 1,
    female = 0,
}

export type User = {
    user_id: string
    user_avatar?: string | null
    user_nickname?: string | null
    user_gender?: UserGender | null
    user_phone?: string | null
    user_email?: string | null
    isMembership?: boolean
}

export type UserInfo = {
    user: User
    token: string
    bazi?: Bazi
}

// ── 八字 ────────────────────────────────────────────────

export enum BaziReportStatus {
    START = 0,
    END = 1,
    FAIL = -1,
}

export type Bazi = {
    bazi_id: string
    user_id: string
    bazi_gender: UserGender
    bazi_is_lunar: 0 | 1
    bazi_create_time: Long
    bazi_report?: string
    bazi_report_time?: Long
    bazi_report_status?: BaziReportStatus | null
    bazi_active: 1 | 0
    bazi_is_deleted: 1 | 0
    bazi_is_edited: 0 | 1

    // 解密后的明文字段
    bazi_name: string
    bazi_birthday: Long
    bazi_real_sun_time: Long
    bazi_province?: string | null
    bazi_city?: string | null
    bazi_region?: string | null
}
