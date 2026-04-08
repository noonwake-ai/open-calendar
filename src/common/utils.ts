/**
 * 从 monorepo common/utils.ts 摘取的 PI 前端实际使用的函数
 * Reason: 不复制整文件，避免 Buffer 引用和无关代码
 */
import dayjs from 'dayjs'
import type { Long } from './base'
import baziHelpers from './helpers/bazi-helpers'

export function timeBeautifySimple(time: Long): string {
    return dayjs(time).format('HH:mm')
}

/**
 * 清理 LLM 响应中的思考标签和 markdown 代码块
 */
export function cleanLLMResponse(text: string): string {
    let result = text.trim()
    result = result.replace(/<think>[\s\S]*?<\/think>/gi, '')
    result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    result = result.replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    result = result.replace(/```json\n?|\n?```/g, '')
    return result.trim()
}

export function uuid(keepSeparator?: boolean): string {
    const s: any[] = []
    const hexDigits = '0123456789abcdef'
    for (let i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1)
    }
    s[14] = '4'
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1)
    s[8] = s[13] = s[18] = s[23] = '-'
    return keepSeparator ? s.join('') : s.join('').replace(/-/g, '')
}

/**
 * 格式化日期时间 + 干支 + 五行
 * Reason: 与 bazi-helpers 存在循环引用（bazi-helpers 也 import 本文件的 timeBeautifySimple），
 * Vite 的 ESM 处理保证函数体执行时模块已就绪，不会在初始化阶段出错
 */
export function dateTimeWuxing(time: Long): string {
    const day = dayjs(time)
    try {
        const lunar = baziHelpers.getLunarHour(time)

        const yearGan = lunar.getYearSixtyCycle().getHeavenStem()
        const yearZhi = lunar.getYearSixtyCycle().getEarthBranch()
        const monthGan = lunar.getMonthSixtyCycle().getHeavenStem()
        const monthZhi = lunar.getMonthSixtyCycle().getEarthBranch()
        const dayGan = lunar.getDaySixtyCycle().getHeavenStem()
        const dayZhi = lunar.getDaySixtyCycle().getEarthBranch()
        const timeZhi = lunar.getSixtyCycleHour().getSixtyCycle().getEarthBranch()
        const lunarTimeStr = `${yearGan.getName()}${yearZhi.getName()}年 ${monthGan.getName()}${monthZhi.getName()}月 ${dayGan.getName()}${dayZhi.getName()}日 ${timeZhi}时`

        const yearGanWuxing = lunar.getYearSixtyCycle().getHeavenStem().getElement()
        const yearZhiWuxing = lunar.getYearSixtyCycle().getEarthBranch().getElement()
        const monthGanWuxing = lunar.getMonthSixtyCycle().getHeavenStem().getElement()
        const monthZhiWuxing = lunar.getMonthSixtyCycle().getEarthBranch().getElement()
        const dayGanWuxing = lunar.getDaySixtyCycle().getHeavenStem().getElement()
        const dayZhiWuxing = lunar.getDaySixtyCycle().getEarthBranch().getElement()
        const wuxing = `五行：${yearGanWuxing}${yearZhiWuxing}｜${monthGanWuxing}${monthZhiWuxing}｜${dayGanWuxing}${dayZhiWuxing}`
        return `${day.format('YYYY-MM-DD HH:mm')}｜${lunarTimeStr}｜${wuxing}`
    } catch (e) {
        console.error(e)
        return day.format('YYYY-MM-DD HH:mm')
    }
}
