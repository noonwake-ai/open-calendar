import React, { ReactElement } from 'react'
import { colors, fontSize, radius, spacing, whiteAlpha } from '../styles/tokens'

interface ReadingLoadingProps {
    text?: string
}

const LINE_WIDTHS = ['100%', '84%', '92%']

export default function ReadingLoading({ text }: ReadingLoadingProps): ReactElement {
    return (
        <>
            <style>{`
                @keyframes reading-loading-sweep {
                    from { transform: translateX(-160%); }
                    to { transform: translateX(260%); }
                }
            `}</style>

            <div style={wrapStyle} aria-live="polite">
                {text && <p style={textStyle}>{text}</p>}
                <div style={linesStyle}>
                    {LINE_WIDTHS.map((width, index) => (
                        <div key={width} style={{ ...lineTrackStyle, width }}>
                            <div
                                style={{
                                    ...lineSweepStyle,
                                    animationDelay: `${index * 0.18}s`,
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}

const wrapStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.md}px`,
    padding: `${spacing.md}px 0`,
}

const textStyle: React.CSSProperties = {
    margin: 0,
    color: colors.text.muted,
    fontSize: fontSize.md,
    letterSpacing: '0.6px',
}

const linesStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.sm}px`,
}

const lineTrackStyle: React.CSSProperties = {
    position: 'relative',
    height: '12px',
    overflow: 'hidden',
    borderRadius: radius.full,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 100%)',
}

const lineSweepStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '34%',
    borderRadius: radius.full,
    background: `linear-gradient(90deg, ${whiteAlpha(0)} 0%, ${whiteAlpha(0.18)} 30%, ${whiteAlpha(0.92)} 50%, ${whiteAlpha(0.18)} 70%, ${whiteAlpha(0)} 100%)`,
    animation: 'reading-loading-sweep 1.65s ease-in-out infinite',
    willChange: 'transform',
}
