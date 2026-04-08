/**
 * 热敏打印机服务客户端
 * 对接树莓派本地打印服务 (ESC/POS)
 */

const PRINTER_BASE_URL = '/printer'
const PRINT_TIMEOUT = 10000

export type PrintResult = { ok: boolean; error?: string }

/** 带超时的 fetch，超时后自动 abort */
async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout = PRINT_TIMEOUT,
): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}

/** 发送双行文本到热敏打印机 */
async function print(line1: string, line2: string): Promise<PrintResult> {
    try {
        const res = await fetchWithTimeout(`${PRINTER_BASE_URL}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ line1, line2 }),
        })

        if (!res.ok) {
            return { ok: false, error: `打印服务异常（状态码 ${res.status}）` }
        }

        let json: any
        try {
            json = await res.json()
        } catch {
            return { ok: false, error: '打印服务返回格式异常' }
        }

        if (json.ok === false || json.error) {
            return { ok: false, error: json.error ?? '打印机返回未知错误' }
        }

        return { ok: true }
    } catch (e: any) {
        if (e?.name === 'AbortError') {
            return { ok: false, error: '打印超时，请检查打印机连接' }
        }
        return { ok: false, error: '无法连接打印服务，请检查网络' }
    }
}

/** 打印机健康检查 */
async function health(): Promise<PrintResult> {
    try {
        const res = await fetchWithTimeout(`${PRINTER_BASE_URL}/health`, {
            method: 'GET',
        })

        if (!res.ok) {
            return { ok: false, error: `打印服务不可用（状态码 ${res.status}）` }
        }

        return { ok: true }
    } catch (e: any) {
        if (e?.name === 'AbortError') {
            return { ok: false, error: '健康检查超时' }
        }
        return { ok: false, error: '无法连接打印服务' }
    }
}

export default { print, health }
