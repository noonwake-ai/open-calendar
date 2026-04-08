import React, { ReactElement, useEffect, useState } from 'react'
import { getProjectionVideos } from '../video/tengod-projection-videos'
import { listenProjectionChannel } from '../utils/projection-channel'
import { TengodId } from '../common/utils/bazi'
import { whiteAlpha } from '../styles/tokens'

type ProjectionScene = 'idle' | 'wake' | 'interpret' | 'casting'

const DEMO_TENGOD_ID = TengodId.SHISHEN

export default function ProjectionScreen(): ReactElement {
    const [videoIndex, setVideoIndex] = useState(0)
    const [scene, setScene] = useState<ProjectionScene>('idle')

    useEffect(() => {
        return listenProjectionChannel((msg) => {
            if (msg.type === 'trigger_scene') {
                if (msg.scene === 'idle') {
                    // 主动回到待机：重置到 idle 循环
                    setScene('idle')
                    setVideoIndex(0)
                    return
                }
                setScene(msg.scene)
                setVideoIndex(0)
            }
        })
    }, [])

    const videos = getProjectionVideos(DEMO_TENGOD_ID, scene)
    const fallbackIdleVideos = getProjectionVideos(DEMO_TENGOD_ID, 'idle')
    const activeVideos = videos.length > 0 ? videos : fallbackIdleVideos
    const currentVideo = activeVideos[videoIndex] ?? null

    const playNextVideo = () => {
        if (scene === 'wake' || scene === 'casting') {
            // wake 和 casting 播完回 idle
            if (videoIndex < activeVideos.length - 1) {
                setVideoIndex(prev => prev + 1)
                return
            }
            setScene('idle')
            setVideoIndex(0)
            return
        }

        if (scene === 'interpret') {
            // interpret 循环播放，等主屏发 idle 消息才停
            setVideoIndex(prev => (prev + 1) % activeVideos.length)
            return
        }

        if (activeVideos.length <= 1) {
            setVideoIndex(0)
            return
        }

        setVideoIndex(prev => (prev + 1) % activeVideos.length)
    }

    if (!currentVideo) {
        return (
            <div style={centerStyle}>
                <p style={statusTextStyle}>暂无视频素材</p>
            </div>
        )
    }

    return (
        <div style={pageStyle}>
            <video
                key={currentVideo}
                src={currentVideo}
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={playNextVideo}
                onError={playNextVideo}
                style={videoStyle}
            />

            {/* <div style={overlayStyle}>
                <p style={eyebrowStyle}>今日值守十神</p>
                <h1 style={nameStyle}>比肩</h1>
                <p style={metaStyle}>{scene === 'wake' ? '唤醒中' : scene === 'interpret' ? '解读中' : scene === 'casting' ? '摇卦中' : '常驻待机'}</p>
            </div> */}
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
}

const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: '32px',
    bottom: '28px',
    padding: '18px 22px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(8, 8, 8, 0.78), rgba(8, 8, 8, 0.32))',
    border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(12px)',
}

const eyebrowStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.32em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
}

const nameStyle: React.CSSProperties = {
    margin: '10px 0 0',
    fontSize: '40px',
    lineHeight: 1,
    fontWeight: 300,
    color: '#f8f4ea',
}

const metaStyle: React.CSSProperties = {
    margin: '10px 0 0',
    fontSize: '14px',
    color: whiteAlpha(0.72),
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

const emptyCardStyle: React.CSSProperties = {
    maxWidth: '520px',
    padding: '28px 32px',
    borderRadius: '24px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center',
}

const emptyTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '28px',
    fontWeight: 300,
    color: '#f8f4ea',
}

const emptyDescStyle: React.CSSProperties = {
    margin: '12px 0 0',
    fontSize: '14px',
    lineHeight: 1.7,
    color: whiteAlpha(0.68),
}
