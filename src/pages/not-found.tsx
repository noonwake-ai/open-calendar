import React, { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '../router/urls'

export default function NotFound(): ReactElement {
    const navigate = useNavigate()

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: '#e0e0e0',
        }}>
            <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>404</h1>
            <p style={{ fontSize: '16px', opacity: 0.7, marginBottom: '32px' }}>
                页面不存在
            </p>
            <button
                onClick={() => navigate(paths.home.index)}
                style={{
                    padding: '12px 24px',
                    background: '#4a4a8a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: 'pointer',
                }}
            >
                返回首页
            </button>
        </div>
    )
}
