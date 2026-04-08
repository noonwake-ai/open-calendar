import React, { ReactElement } from 'react'
import { colors, fontSize, fontWeight, radius, spacing } from '../styles/tokens'

// 卡片尺寸：宽 260px，高按背景图旋转后比例 260 × (2048/1374) ≈ 388px
const CARD_W = 260
const CARD_H = 388

interface PrintSignCardProps {
    topText: string            // 顶部小字（如干支日期）
    line1: string              // 第一行文案（4字）
    line2: string              // 第二行文案（4字）
    bottomText: string         // 底部小字（如类型名称）
    accentColor: string        // 主题色（仅用于按钮等）
    buttonLabel?: string       // 打印按钮文案，默认"打印签文"
    onPrint?: () => void
}

export default function PrintSignCard({
    topText,
    line1,
    line2,
    bottomText,
    accentColor,
    buttonLabel = '打印签文',
    onPrint = () => window.alert('正在连接热敏打印机...'),
}: PrintSignCardProps): ReactElement {
    return (
        <div style={wrapperStyle}>
            {/* 签文卡片 */}
            <div style={cardStyle}>
                {/* 旋转 90° 的背景图层 */}
                <div style={bgLayerStyle} />
                {/* 内容层 */}
                <div style={textBlockStyle}>
                    <p style={signLineStyle}>{line1}</p>
                    <p style={signLineStyle}>{line2}</p>
                </div>
            </div>
            <button
                onClick={onPrint}
                style={{ ...printBtnStyle, background: accentColor }}
            >
                {buttonLabel}
            </button>
        </div>
    )
}

const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: `${spacing.lg}px`,
}

const cardStyle: React.CSSProperties = {
    width: `${CARD_W}px`,
    height: `${CARD_H}px`,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.sm}px ${spacing.md}px`,
    boxSizing: 'border-box',
}

// 背景图层：宽=CARD_H，高=CARD_W，旋转90°后正好填满卡片
const bgLayerStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${CARD_H}px`,
    height: `${CARD_W}px`,
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%) rotate(90deg)`,
    backgroundImage: 'url(/print-bg.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    zIndex: 0,
}

const smallTextStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: '#000000',
    letterSpacing: '1.5px',
    opacity: 0.6,
    position: 'relative',
    zIndex: 1,
}

const textBlockStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    position: 'relative',
    zIndex: 1,
}

const signLineStyle: React.CSSProperties = {
    margin: 0,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: '#000000',
    letterSpacing: '4px',
}

const printBtnStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: radius.sm,
    color: colors.black,
    cursor: 'pointer',
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    padding: `${spacing.xs}px ${spacing.xl}px`,
    letterSpacing: '1px',
}
