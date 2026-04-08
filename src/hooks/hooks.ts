import { getDeviceToken } from '../utils/device'

export function useDeviceAuth(): { isAuthed: boolean } {
    const token = getDeviceToken()
    return { isAuthed: !!token }
}
