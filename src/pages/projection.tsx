import React, { ReactElement, useEffect, useRef, useState, useCallback } from 'react'
import { getProjectionVideos } from '../video/tengod-projection-videos'
import { listenProjectionChannel } from '../utils/projection-channel'
import { TengodId } from '../common/utils/bazi'

type ProjectionScene = 'sleep' | 'idle' | 'wake' | 'interpret' | 'casting'

const DEMO_TENGOD_ID = TengodId.SHISHEN

export default function ProjectionScreen(): ReactElement {
    const videoRef = useRef<HTMLVideoElement>(null)
    // Reason: 默认 sleep，等待主屏唤醒后再播放十神视频
    const [scene, setScene] = useState<ProjectionScene>('sleep')
    // Reason: BroadcastChannel 回调在 useEffect 闭包中，直接读 scene 会是旧值
    const sceneRef = useRef<ProjectionScene>('sleep')
    sceneRef.current = scene
    const indexRef = useRef(0)
    const playlistRef = useRef<string[]>([])

    const resolvePlaylist = useCallback((s: 'idle' | 'interpret' | 'casting'): string[] => {
        const videos = getProjectionVideos(DEMO_TENGOD_ID, s)
        if (videos.length > 0) return videos
        return getProjectionVideos(DEMO_TENGOD_ID, 'idle')
    }, [])

    // Reason: 就地更新 video.src，不销毁 DOM 元素，避免 Pi compositor 重建 surface 导致白闪
    // Reason: 投影窗口无直接用户手势，Chrome 会拒绝带音频视频的 autoplay（即便 play() 有时不 reject 而是内部 suspend，
    //         catch 也不会触发）。解法：play() 前先静音确保 play 成功，play 启动后立即取消静音恢复音频
    const playVideo = useCallback((src: string) => {
        const el = videoRef.current
        if (!el) return
        el.muted = true
        el.src = src
        el.load()
        el.play().catch(() => {})
    }, [])

    const playNextVideo = useCallback(() => {
        const currentScene = sceneRef.current
        const playlist = playlistRef.current

        if (currentScene === 'wake') {
            // 唤醒视频播完 → 切到 idle
            const idleVids = resolvePlaylist('idle')
            sceneRef.current = 'idle'
            setScene('idle')
            playlistRef.current = idleVids
            indexRef.current = 0
            if (idleVids.length > 0) playVideo(idleVids[0])
            return
        }

        if (currentScene === 'casting') {
            if (indexRef.current < playlist.length - 1) {
                indexRef.current += 1
                playVideo(playlist[indexRef.current])
                return
            }
            const idleVideos = resolvePlaylist('idle')
            sceneRef.current = 'idle'
            setScene('idle')
            playlistRef.current = idleVideos
            indexRef.current = 0
            playVideo(idleVideos[0])
            return
        }

        // idle / interpret: 循环
        if (playlist.length <= 1) {
            indexRef.current = 0
        } else {
            indexRef.current = (indexRef.current + 1) % playlist.length
        }
        if (playlist.length > 0) playVideo(playlist[indexRef.current])
    }, [playVideo, resolvePlaylist])

    useEffect(() => {
        return listenProjectionChannel((msg) => {
            if (msg.type !== 'trigger_scene') return

            if (msg.scene === 'sleep') {
                sceneRef.current = 'sleep'
                setScene('sleep')
                playlistRef.current = []
                const el = videoRef.current
                if (el) { el.pause(); el.src = '' }
                return
            }

            if (msg.scene === 'wake') {
                // Reason: 解卦/摇卦中不响应唤醒，避免打断当前场景；sleep/idle 可响应
                if (sceneRef.current !== 'idle' && sceneRef.current !== 'sleep') return
                const wakeVideos = getProjectionVideos(DEMO_TENGOD_ID, 'wake')
                if (wakeVideos.length === 0) {
                    const idleVids = resolvePlaylist('idle')
                    sceneRef.current = 'idle'
                    setScene('idle')
                    playlistRef.current = idleVids
                    indexRef.current = 0
                    if (idleVids.length > 0) playVideo(idleVids[0])
                    return
                }
                const wakeVideo = wakeVideos[Math.floor(Math.random() * wakeVideos.length)]
                sceneRef.current = 'wake'
                setScene('wake')
                playlistRef.current = []
                indexRef.current = 0
                playVideo(wakeVideo)
                return
            }

            if (msg.scene === 'idle') {
                const idleVids = resolvePlaylist('idle')
                sceneRef.current = 'idle'
                setScene('idle')
                playlistRef.current = idleVids
                indexRef.current = 0
                if (idleVids.length > 0) playVideo(idleVids[0])
                return
            }

            // interpret / casting
            const newPlaylist = resolvePlaylist(msg.scene)
            sceneRef.current = msg.scene
            setScene(msg.scene)
            playlistRef.current = newPlaylist
            indexRef.current = 0
            if (newPlaylist.length > 0) playVideo(newPlaylist[0])
        })
    }, [playVideo, resolvePlaylist])

    return (
        <div style={pageStyle}>
            {/* Reason: 不用 key，video 元素永远不销毁，compositor surface 持续存在 */}
            <video
                ref={videoRef}
                playsInline
                preload="auto"
                onEnded={playNextVideo}
                onError={playNextVideo}
                style={{
                    ...videoStyle,
                    // 唤醒时播放 clip-path 圆形展开动画，圆心偏上让人物头部先露出
                    animation: scene === 'wake' ? 'wake-reveal 10000ms cubic-bezier(0.22, 1, 0.36, 1) both' : 'none',
                }}
            />
            {/* 唤醒时叠加 vignette，营造圆形边缘羽化效果 */}
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
}

const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#000000',
}

