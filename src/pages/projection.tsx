import React, { ReactElement, useEffect, useRef, useState, useCallback } from 'react'
import { getProjectionVideos } from '../video/tengod-projection-videos'
import { listenProjectionChannel } from '../utils/projection-channel'
import { TengodId } from '../common/utils/bazi'

type ProjectionScene = 'sleep' | 'idle' | 'wake' | 'interpret' | 'casting'
type VideoSlot = 'A' | 'B'

const DEMO_TENGOD_ID = TengodId.SHISHEN
// Reason: 提前切换窗口 0.5s，Pi 负载高时 timeupdate 间隔可能 >250ms，0.3s 容易被跳过
const EARLY_SWAP_THRESHOLD = 0.5

async function playWithPreferredAudio(el: HTMLVideoElement): Promise<void> {
    el.muted = false
    try {
        await el.play()
    } catch {
        el.muted = true
        el.play().catch(() => {})
    }
}

export default function ProjectionScreen(): ReactElement {
    const videoA = useRef<HTMLVideoElement>(null)
    const videoB = useRef<HTMLVideoElement>(null)
    const activeSlotRef = useRef<VideoSlot>('A')

    // Reason: 默认 sleep，等待主屏唤醒后再播放十神视频
    const [scene, setScene] = useState<ProjectionScene>('sleep')
    const sceneRef = useRef<ProjectionScene>('sleep')
    sceneRef.current = scene

    const indexRef = useRef(0)
    const playlistRef = useRef<string[]>([])
    // Reason: 全局代次，每次场景切换 +1，旧事件校验丢弃
    const generationRef = useRef(0)
    const standbyReadyRef = useRef(false)
    // Reason: swap 互斥锁，防止 timeupdate 连续触发导致重复 swap
    const swapLockRef = useRef(false)

    const getActive = useCallback(() =>
        activeSlotRef.current === 'A' ? videoA.current : videoB.current, [])
    const getStandby = useCallback(() =>
        activeSlotRef.current === 'A' ? videoB.current : videoA.current, [])

    const resolvePlaylist = useCallback((s: 'idle' | 'interpret' | 'casting'): string[] => {
        const videos = getProjectionVideos(DEMO_TENGOD_ID, s)
        if (videos.length > 0) return videos
        return getProjectionVideos(DEMO_TENGOD_ID, 'idle')
    }, [])

    // Reason: 就地更新单个 video.src 的兜底方法（standby 未 ready 时降级使用）
    const playVideoFallback = useCallback((src: string) => {
        const el = getActive()
        if (!el) return
        el.src = src
        el.load()
        void playWithPreferredAudio(el)
    }, [getActive])

    // ─── swap：standby 置顶盖住 active ───
    const swap = useCallback(() => {
        if (swapLockRef.current) return
        swapLockRef.current = true

        const active = getActive()
        const standby = getStandby()
        if (!standby) { swapLockRef.current = false; return }

        activeSlotRef.current = activeSlotRef.current === 'A' ? 'B' : 'A'
        standby.style.zIndex = '2'
        void playWithPreferredAudio(standby)

        if (active) {
            active.style.zIndex = '0'
            // Reason: 延迟 pause，确保 standby 已稳定接管画面
            setTimeout(() => {
                active.pause()
                swapLockRef.current = false
            }, 150)
        } else {
            swapLockRef.current = false
        }
    }, [getActive, getStandby])

    // ─── 预加载下一条到 standby ───
    const preloadNext = useCallback(() => {
        const standby = getStandby()
        if (!standby) return

        const currentScene = sceneRef.current
        // Reason: wake 是单条视频，播完直接切 idle，预加载 idle[0]
        if (currentScene === 'wake') {
            const idleVideos = resolvePlaylist('idle')
            const src = idleVideos[0]
            if (!src) return
            standbyReadyRef.current = false
            standby.src = src
            standby.load()
            return
        }

        const playlist = playlistRef.current
        const index = indexRef.current

        // 计算下一条
        let nextSrc: string | undefined
        if (currentScene === 'casting') {
            if (index < playlist.length - 1) {
                nextSrc = playlist[index + 1]
            } else {
                // casting 播完回 idle，预加载 idle[0]
                const idleVideos = resolvePlaylist('idle')
                nextSrc = idleVideos[0]
            }
        } else {
            // idle / interpret: 循环
            const nextIndex = playlist.length <= 1 ? 0 : (index + 1) % playlist.length
            nextSrc = playlist[nextIndex]
        }

        if (!nextSrc) return
        standbyReadyRef.current = false
        standby.src = nextSrc
        standby.load()
    }, [getStandby, resolvePlaylist])

    // ─── 推进 index + scene，然后预加载再下一条 ───
    const advanceAndPreload = useCallback(() => {
        const currentScene = sceneRef.current
        const playlist = playlistRef.current

        if (currentScene === 'wake') {
            // wake 播完 → idle
            const idleVids = resolvePlaylist('idle')
            sceneRef.current = 'idle'
            setScene('idle')
            playlistRef.current = idleVids
            indexRef.current = 0
        } else if (currentScene === 'casting') {
            if (indexRef.current < playlist.length - 1) {
                indexRef.current += 1
            } else {
                // casting 播完 → idle
                const idleVideos = resolvePlaylist('idle')
                sceneRef.current = 'idle'
                setScene('idle')
                playlistRef.current = idleVideos
                indexRef.current = 0
            }
        } else {
            // idle / interpret: 循环
            if (playlist.length <= 1) {
                indexRef.current = 0
            } else {
                indexRef.current = (indexRef.current + 1) % playlist.length
            }
        }

        preloadNext()
    }, [preloadNext, resolvePlaylist])

    // ─── timeupdate：检测接近结尾时提前 swap ───
    const onTimeUpdate = useCallback((slot: VideoSlot, gen: number) => {
        if (gen !== generationRef.current) return
        if (slot !== activeSlotRef.current) return
        if (swapLockRef.current) return
        if (!standbyReadyRef.current) return

        const el = slot === 'A' ? videoA.current : videoB.current
        if (!el || !el.duration) return

        const remaining = el.duration - el.currentTime
        if (remaining <= EARLY_SWAP_THRESHOLD && remaining > 0) {
            swap()
            advanceAndPreload()
        }
    }, [swap, advanceAndPreload])

    // ─── ended 兜底 ───
    const onEnded = useCallback((slot: VideoSlot, gen: number) => {
        if (gen !== generationRef.current) return
        if (slot !== activeSlotRef.current) return
        if (swapLockRef.current) return

        if (standbyReadyRef.current) {
            swap()
            advanceAndPreload()
        } else {
            // Reason: standby 未 ready 时降级为单 video 直接换 src
            const currentScene = sceneRef.current
            const playlist = playlistRef.current

            if (currentScene === 'wake') {
                const idleVids = resolvePlaylist('idle')
                sceneRef.current = 'idle'
                setScene('idle')
                playlistRef.current = idleVids
                indexRef.current = 0
                if (idleVids.length > 0) playVideoFallback(idleVids[0])
            } else if (currentScene === 'casting' && indexRef.current >= playlist.length - 1) {
                const idleVideos = resolvePlaylist('idle')
                sceneRef.current = 'idle'
                setScene('idle')
                playlistRef.current = idleVideos
                indexRef.current = 0
                if (idleVideos.length > 0) playVideoFallback(idleVideos[0])
            } else if (currentScene === 'casting') {
                indexRef.current += 1
                playVideoFallback(playlist[indexRef.current])
            } else {
                // idle / interpret 循环
                const nextIndex = playlist.length <= 1 ? 0 : (indexRef.current + 1) % playlist.length
                indexRef.current = nextIndex
                if (playlist.length > 0) playVideoFallback(playlist[nextIndex])
            }
            preloadNext()
        }
    }, [swap, advanceAndPreload, resolvePlaylist, playVideoFallback, preloadNext])

    // ─── standby ready ───
    const onStandbyReady = useCallback((slot: VideoSlot, gen: number) => {
        if (gen !== generationRef.current) return
        if (slot === activeSlotRef.current) return
        standbyReadyRef.current = true
    }, [])

    // ─── 场景切换 ───
    useEffect(() => {
        return listenProjectionChannel((msg) => {
            if (msg.type !== 'trigger_scene') return

            if (msg.scene === 'sleep') {
                generationRef.current += 1
                swapLockRef.current = false
                sceneRef.current = 'sleep'
                setScene('sleep')
                playlistRef.current = []
                standbyReadyRef.current = false
                const elA = videoA.current
                const elB = videoB.current
                if (elA) { elA.pause(); elA.src = '' }
                if (elB) { elB.pause(); elB.src = '' }
                return
            }

            if (msg.scene === 'wake') {
                if (sceneRef.current !== 'idle' && sceneRef.current !== 'sleep') return
                const wakeVideos = getProjectionVideos(DEMO_TENGOD_ID, 'wake')
                if (wakeVideos.length === 0) {
                    // 没有 wake 素材，直接进 idle
                    generationRef.current += 1
                    swapLockRef.current = false
                    const idleVids = resolvePlaylist('idle')
                    sceneRef.current = 'idle'
                    setScene('idle')
                    playlistRef.current = idleVids
                    indexRef.current = 0
                    standbyReadyRef.current = false
                    if (idleVids.length > 0) playVideoFallback(idleVids[0])
                    preloadNext()
                    return
                }
                // Reason: wake 随机选一条，用 standby 加载后 swap
                generationRef.current += 1
                swapLockRef.current = false
                const wakeVideo = wakeVideos[Math.floor(Math.random() * wakeVideos.length)]
                sceneRef.current = 'wake'
                setScene('wake')
                playlistRef.current = []
                indexRef.current = 0
                standbyReadyRef.current = false

                const standby = getStandby()
                if (!standby) return
                const gen = generationRef.current
                const onReady = () => {
                    standby.removeEventListener('canplay', onReady)
                    standby.removeEventListener('loadeddata', onReady)
                    if (gen !== generationRef.current) return
                    standbyReadyRef.current = true
                    swap()
                    // wake 播完会切 idle，提前预加载 idle[0]
                    preloadNext()
                }
                standby.addEventListener('canplay', onReady)
                standby.addEventListener('loadeddata', onReady)
                standby.src = wakeVideo
                standby.load()
                if (standby.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onReady()
                return
            }

            if (msg.scene === 'idle') {
                generationRef.current += 1
                swapLockRef.current = false
                const idleVids = resolvePlaylist('idle')
                sceneRef.current = 'idle'
                setScene('idle')
                playlistRef.current = idleVids
                indexRef.current = 0
                standbyReadyRef.current = false

                const standby = getStandby()
                if (!standby || idleVids.length === 0) return
                const gen = generationRef.current
                const onReady = () => {
                    standby.removeEventListener('canplay', onReady)
                    standby.removeEventListener('loadeddata', onReady)
                    if (gen !== generationRef.current) return
                    standbyReadyRef.current = true
                    swap()
                    preloadNext()
                }
                standby.addEventListener('canplay', onReady)
                standby.addEventListener('loadeddata', onReady)
                standby.src = idleVids[0]
                standby.load()
                if (standby.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onReady()
                return
            }

            // interpret / casting
            generationRef.current += 1
            swapLockRef.current = false
            const newPlaylist = resolvePlaylist(msg.scene)
            sceneRef.current = msg.scene
            setScene(msg.scene)
            playlistRef.current = newPlaylist
            indexRef.current = 0
            standbyReadyRef.current = false

            const standby = getStandby()
            if (!standby || newPlaylist.length === 0) return
            const gen = generationRef.current
            const onReady = () => {
                standby.removeEventListener('canplay', onReady)
                standby.removeEventListener('loadeddata', onReady)
                if (gen !== generationRef.current) return
                standbyReadyRef.current = true
                swap()
                preloadNext()
            }
            standby.addEventListener('canplay', onReady)
            standby.addEventListener('loadeddata', onReady)
            standby.src = newPlaylist[0]
            standby.load()
            if (standby.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onReady()
        })
    }, [getStandby, swap, preloadNext, resolvePlaylist, playVideoFallback])

    // ─── 事件绑定 ───
    useEffect(() => {
        const elA = videoA.current
        const elB = videoB.current

        const handleTimeUpdateA = () => onTimeUpdate('A', generationRef.current)
        const handleTimeUpdateB = () => onTimeUpdate('B', generationRef.current)
        const handleEndedA = () => onEnded('A', generationRef.current)
        const handleEndedB = () => onEnded('B', generationRef.current)
        const handleErrorA = () => onEnded('A', generationRef.current)
        const handleErrorB = () => onEnded('B', generationRef.current)
        const handleReadyA = () => onStandbyReady('A', generationRef.current)
        const handleReadyB = () => onStandbyReady('B', generationRef.current)

        elA?.addEventListener('timeupdate', handleTimeUpdateA)
        elA?.addEventListener('ended', handleEndedA)
        elA?.addEventListener('error', handleErrorA)
        elA?.addEventListener('canplay', handleReadyA)
        elA?.addEventListener('loadeddata', handleReadyA)
        elB?.addEventListener('timeupdate', handleTimeUpdateB)
        elB?.addEventListener('ended', handleEndedB)
        elB?.addEventListener('error', handleErrorB)
        elB?.addEventListener('canplay', handleReadyB)
        elB?.addEventListener('loadeddata', handleReadyB)

        return () => {
            elA?.removeEventListener('timeupdate', handleTimeUpdateA)
            elA?.removeEventListener('ended', handleEndedA)
            elA?.removeEventListener('error', handleErrorA)
            elA?.removeEventListener('canplay', handleReadyA)
            elA?.removeEventListener('loadeddata', handleReadyA)
            elB?.removeEventListener('timeupdate', handleTimeUpdateB)
            elB?.removeEventListener('ended', handleEndedB)
            elB?.removeEventListener('error', handleErrorB)
            elB?.removeEventListener('canplay', handleReadyB)
            elB?.removeEventListener('loadeddata', handleReadyB)
        }
    }, [onTimeUpdate, onEnded, onStandbyReady])

    // Reason: 当前活跃 slot 的 video 需要应用 wake 动画，用 CSS class 区分
    const slotStyleA: React.CSSProperties = {
        ...videoSlotStyle,
        zIndex: 2,
        animation: scene === 'wake' && activeSlotRef.current === 'A'
            ? 'wake-reveal 10000ms cubic-bezier(0.22, 1, 0.36, 1) both' : 'none',
    }
    const slotStyleB: React.CSSProperties = {
        ...videoSlotStyle,
        zIndex: 0,
        animation: scene === 'wake' && activeSlotRef.current === 'B'
            ? 'wake-reveal 10000ms cubic-bezier(0.22, 1, 0.36, 1) both' : 'none',
    }

    return (
        <div style={pageStyle}>
            <video ref={videoA} playsInline preload="auto" style={slotStyleA} />
            <video ref={videoB} playsInline preload="auto" style={slotStyleB} />
            {scene === 'wake' && <div style={wakeVignetteStyle} />}
        </div>
    )
}

const pageStyle: React.CSSProperties = {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#000000',
}

const wakeVignetteStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 30%, transparent 72%, rgba(0,0,0,0.55) 84%, black 94%)',
    pointerEvents: 'none',
    zIndex: 3,
}

const videoSlotStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#000000',
}
