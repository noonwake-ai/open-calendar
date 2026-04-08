import axios from 'axios'

declare const __APP_CONFIG_FILE__: string

export type AppConfig = {
    BASE_URL: string
    DEVICE_TOKEN?: string
    ASR_WS_URL?: string
    PI_EVENT_BRIDGE_URL?: string
    DIFY?: {
        BASE_URL: string
        HEXAGRAM_REPORT_KEY: string
        FORTUNE_REPORT_KEY: string
        SPECIAL_DAY_REPORT_KEY: string
        CHAT_DEMO_KEY: string
    }
    DOUBAO?: {
        APP_ID: string
        ACCESS_KEY: string
        SPEAKER: string
    }
}

// Reason: Promise 去重，防止并发调用（如 TTS PREFETCH=3）重复请求运行时配置
let configPromise: Promise<AppConfig> | null = null

/**
 * 读取运行时配置（独占缓存，其他模块只消费不持有）
 */
export async function getAppConfig(): Promise<AppConfig> {
    if ((window as any).APP_CONFIG) {
        return (window as any).APP_CONFIG
    }
    if (!configPromise) {
        const fallbackConfigFile = import.meta.env.DEV ? 'config.dev.json' : 'config.json'
        const configFile = typeof __APP_CONFIG_FILE__ === 'string' ? __APP_CONFIG_FILE__ : fallbackConfigFile
        const configUrl = `${import.meta.env.BASE_URL}config/${configFile}`
        configPromise = axios.get<AppConfig>(configUrl).then(res => {
            // Reason: dev 下 BASE_URL 用 '/' 走 Vite proxy，其余字段仍从开发配置文件读取
            const config = import.meta.env.DEV
                ? { ...res.data, BASE_URL: '/' }
                : res.data
            ;(window as any).APP_CONFIG = config
            return config
        }).catch(err => {
            configPromise = null
            throw err
        })
    }
    return configPromise
}
