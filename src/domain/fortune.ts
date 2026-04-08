/**
 * 运势相关类型和常量
 * 从 monorepo common/models/table.ts + daily-fortune-report.ts 提取
 */
import type { Int, Long } from './types'

// ── 每日运势 ──────────────────────────────────────────────

export enum DailyFortuneStatus {
    NoBaziCancel = -20,
    Fail = -10,
    Inited = 0,
    Processing = 10,
    Completed = 20,
}

export type T_DAILY_FORTUNE = {
    user_id: string
    daily_fortune_day_time: Long
    daily_fortune_luck_index?: Int | null
    daily_fortune_should?: string | null
    daily_fortune_should_second?: string | null
    daily_fortune_avoid?: string | null
    daily_fortune_avoid_second?: string | null
    daily_fortune_luck_color?: string | null
    daily_fortune_luck_color_name?: string | null
    daily_fortune_luck_food?: string | null
    daily_fortune_conversation_id?: string | null
    daily_fortune_chat_id?: string | null
    daily_fortune_message_id?: string | null
    daily_fortune_start_time?: Long | null
    daily_fortune_complete_time?: Long | null
    bazi_id?: string | null
    daily_fortune_content?: string | null
    daily_fortune_status: DailyFortuneStatus
}

// ── 运势类型 ──────────────────────────────────────────────

export enum DailyFortuneType {
    Love = 'love',
    Wealth = 'wealth',
    Career = 'career',
    Study = 'study',
}

export const DailyFortuneType2Label: Record<DailyFortuneType, string> = {
    [DailyFortuneType.Love]: '感情运势',
    [DailyFortuneType.Wealth]: '财富运势',
    [DailyFortuneType.Career]: '事业运势',
    [DailyFortuneType.Study]: '学业运势',
}

export const DailyFortuneType2Question: Record<DailyFortuneType, string> = {
    [DailyFortuneType.Love]: '今日感情运势如何？',
    [DailyFortuneType.Wealth]: '今日财富运势如何？',
    [DailyFortuneType.Career]: '今日事业运势如何？',
    [DailyFortuneType.Study]: '今日学业运势如何？',
}

// ── 特殊日 ───────────────────────────────────────────────

export type SpecialDayCategory = 'solar' | 'ganRelation' | 'tenGodBranch'

// ── 运势报告内容 ──────────────────────────────────────────

export interface DailyFortuneReportContent {
    fortune_index: 1 | 2 | 3 | 4 | 5
    tags: [string, string, string]
    content: string
    suggestions: Array<string>
    summary: string
}
