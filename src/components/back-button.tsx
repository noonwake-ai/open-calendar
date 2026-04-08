import React from 'react'
import { useNavigate } from 'react-router-dom'
import { colors, radius } from '../styles/tokens'

interface BackButtonProps {
    to?: string
}

export default function BackButton({ to }: BackButtonProps): React.ReactElement {
    const navigate = useNavigate()

    const handleClick = () => {
        if (to) {
            navigate(to)
        } else {
            navigate(-1)
        }
    }

    return (
        <div style={backBtnStyle} onClick={handleClick}>
            <span style={{ fontSize: '24px', lineHeight: 1 }}>←</span>
        </div>
    )
}

const backBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '20px',
    left: '20px',
    width: '56px',
    height: '56px',
    borderRadius: radius.full,
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: colors.text.primary,
    flexShrink: 0,
    zIndex: 10,
}
