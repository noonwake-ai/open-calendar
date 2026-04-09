import React, { ReactElement, useEffect, useRef, useState, useCallback } from 'react'
import { getProjectionVideos } from '../video/tengod-projection-videos'
import { listenProjectionChannel } from '../utils/projection-channel'
import { TengodId } from '../common/utils/bazi'
import { whiteAlpha } from '../styles/tokens'

type ProjectionScene = 'idle' | 'wake' | 'interpret' | 'casting'

const DEMO_TENGOD_ID = TengodId.SHISHEN

export default function ProjectionScreen(): ReactElement {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [scene, setScene] = useState<ProjectionScene>('idle')
    const sceneRef = useRef<ProjectionScene>('idle')
    const indexRef = useRef(0)
    const playlistRef = useRef<string[]>([])

    // Reason: 用 ref 追踪 scene，避免事件回调闭包读到旧值
    sceneRef.current = scene

    const resolvePlaylist = useCallback((s: ProjectionScene): string[] => {
        const videos = getProjectionVideos(DEMO_TENGOD_ID, s)
        if (videos.length > 0) return videos
        return getProjectionVideos(DEMO_TENGOD_ID, 'idle')
    }, [])

    // Reason: 就地更新 video.src，不销毁 DOM 元素，避免 Pi compositor 重建 surface 导致白闪
    const playVideo = useCallback((src: string) => {
        const el = videoRef.current
        if (!el) return
        el.src = src
        el.load()
        el.play().catch(() => {})
    }, [])

    const playNextVideo = useCallback(() => {
        const currentScene = sceneRef.current
        const playlist = playlistRef.current

        if (currentScene === 'wake' || currentScene === 'casting') {
            if (indexRef.current < playlist.length - 1) {
                indexRef.current += 1
                playVideo(playlist[indexRef.current])
                return
            }
            // 播完回 idle
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
        playVideo(playlist[indexRef.current])
    }, [playVideo, resolvePlaylist])

    // ─── 初始化 + 监听消息 ───
    useEffect(() => {
        const idleVideos = resolvePlaylist('idle')
        playlistRef.current = idleVideos
        indexRef.current = 0
        if (idleVideos.length > 0) {
            playVideo(idleVideos[0])
        }

        return listenProjectionChannel((msg) => {
            if (msg.type === 'trigger_scene') {
                if (msg.scene === 'wake' && sceneRef.current !== 'idle') return
                if (msg.scene === 'idle') {
                    const idleVids = resolvePlaylist('idle')
                    sceneRef.current = 'idle'
                    setScene('idle')
                    playlistRef.current = idleVids
                    indexRef.current = 0
                    playVideo(idleVids[0])
                    return
                }
                const newPlaylist = resolvePlaylist(msg.scene)
                sceneRef.current = msg.scene
                setScene(msg.scene)
                playlistRef.current = newPlaylist
                indexRef.current = 0
                playVideo(newPlaylist[0])
            }
        })
    }, [playVideo, resolvePlaylist])

    return (
        <div style={pageStyle}>
            {/* Reason: 不用 key，video 元素永远不销毁，compositor surface 持续存在 */}
            <video
                ref={videoRef}
                muted
                playsInline
                preload="auto"
                onEnded={playNextVideo}
                onError={playNextVideo}
                style={videoStyle}
            />
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

const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#000000',
}

const centerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    padding: '24px',
    background: 'radial-gradient(circle at top, #26203c 0%, #09090b 58%)',
}

const statusTextStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '18px',
    color: whiteAlpha(0.82),
}
