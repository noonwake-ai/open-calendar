const DEVICE_TOKEN_KEY = '_all_spirit_pi_device_token'

export function getDeviceToken(): string | null {
    try {
        return localStorage.getItem(DEVICE_TOKEN_KEY)
    } catch (e) {
        console.error(e)
        return null
    }
}

export function setDeviceToken(token: string): void {
    try {
        localStorage.setItem(DEVICE_TOKEN_KEY, token)
    } catch (e) {
        console.error(e)
    }
}

export function clearDeviceToken(): void {
    try {
        localStorage.removeItem(DEVICE_TOKEN_KEY)
    } catch (e) {
        console.error(e)
    }
}
