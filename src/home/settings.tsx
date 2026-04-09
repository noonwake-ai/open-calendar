import React, { ReactElement, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '../router/urls'
import { clearDeviceToken } from '../utils/device'
import { callApi } from '../utils/api'
import { apis } from '../utils/api'
import type { Bazi } from '../domain/types'
import { colors, fontSize, fontWeight, radius, spacing, btn } from '../styles/tokens'
import BackButton from '../components/back-button'
import { clearAllBlessings, clearAllReportCache } from '../utils/local-db'
import { resetToSleep } from './index'
import { sendProjectionMessage } from '../utils/projection-channel'

// UserGender: female=0, male=1, unknown=2
function formatGender(gender: number | null | undefined): string {
    if (gender === 0) return '女'
    if (gender === 1) return '男'
    return '—'
}

function formatBirthday(ts: number | null | undefined): string {
    if (!ts) return '—'
    const d = new Date(ts)
    const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return `${dateStr} ${timeStr}`
}

function formatBirthplace(province: string | null | undefined, city: string | null | undefined, region: string | null | undefined): string {
    if (!province && !city && !region) return '—'
    return [province, city, region].filter(Boolean).join(' ')
}

export default function Settings(): ReactElement {
    const navigate = useNavigate()
    const [bazi, setBazi] = useState<Bazi | null>(null)

    useEffect(() => {
        callApi(apis.mina.bazi.getActive, undefined as any)
            .then(data => setBazi(data ?? null))
            .catch(console.error)
    }, [])

    const handleUnpair = () => {
        clearDeviceToken()
        navigate(paths.login)
    }

    const handleClearBlessings = async () => {
        if (!window.confirm('确定要清理所有祈福待办数据吗？清理后不可恢复。')) return
        try {
            await clearAllBlessings()
            alert('祈福数据已清理')
        } catch (e) {
            console.error('清理祈福数据失败', e)
            alert('清理失败，请重试')
        }
    }

    const handleClearReports = async () => {
        if (!window.confirm('确定要清理所有运势和特殊日报告缓存吗？清理后下次查看将重新生成。')) return
        try {
            await clearAllReportCache()
            localStorage.removeItem('pi_fortune_viewed')
            alert('运势报告已清理')
        } catch (e) {
            console.error('清理运势报告失败', e)
            alert('清理失败，请重试')
        }
    }

    const handleResetToSleep = () => {
        resetToSleep()
        sendProjectionMessage({ type: 'trigger_scene', scene: 'sleep' })
        navigate(paths.home.index)
    }

    const rows: Array<{ label: string; value: string }> = [
        { label: '姓名', value: bazi?.bazi_name ?? '—' },
        { label: '性别', value: formatGender(bazi?.bazi_gender) },
        { label: '出生时间', value: formatBirthday(bazi?.bazi_birthday) },
        { label: '出生地点', value: formatBirthplace(bazi?.bazi_province, bazi?.bazi_city, bazi?.bazi_region) },
    ]

    return (
        <div style={pageStyle}>
            <BackButton to={paths.home.index} />

            <div style={scrollAreaStyle}>
                <p style={sectionLabelStyle}>用户信息</p>

                <div style={{ ...cardStyle, marginTop: `${spacing.xs}px` }}>
                    {rows.map((row, i) => (
                        <React.Fragment key={row.label}>
                            <div style={rowStyle}>
                                <span style={rowLabelStyle}>{row.label}</span>
                                <span style={rowValueStyle}>{row.value}</span>
                            </div>
                            {i < rows.length - 1 && <div style={dividerStyle} />}
                        </React.Fragment>
                    ))}
                </div>

                <p style={{ ...sectionLabelStyle, marginTop: `${spacing.lg}px` }}>数据管理</p>

                <div style={{ ...cardStyle, marginTop: `${spacing.xs}px` }}>
                    <div
                        style={{ ...rowStyle, cursor: 'pointer' }}
                        onClick={handleClearBlessings}
                    >
                        <span style={rowLabelStyle}>清理祈福数据</span>
                        <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>清除本地祈福待办</span>
                    </div>
                    <div style={dividerStyle} />
                    <div
                        style={{ ...rowStyle, cursor: 'pointer' }}
                        onClick={handleClearReports}
                    >
                        <span style={rowLabelStyle}>清理运势报告</span>
                        <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>清除今日运势与特殊日缓存</span>
                    </div>
                    <div style={dividerStyle} />
                    <div
                        style={{ ...rowStyle, cursor: 'pointer' }}
                        onClick={handleResetToSleep}
                    >
                        <span style={rowLabelStyle}>返回未唤醒状态</span>
                        <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>重置为屏保页面</span>
                    </div>
                </div>

                <div style={footerStyle}>
                    <button
                        onClick={handleUnpair}
                        style={{ ...btn.danger, width: '100%', padding: `${spacing.md}px` }}
                    >
                        退出登录
                    </button>
                </div>
            </div>
        </div>
    )
}

const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
}

const scrollAreaStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: `${spacing.lg}px ${spacing.xxl}px`,
    paddingTop: `${spacing.lg + 56 + spacing.sm}px`,
}

const sectionLabelStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    margin: `0 0 4px`,
    letterSpacing: '1px',
}

const cardStyle: React.CSSProperties = {
    background: colors.bg.surface,
    border: `1px solid ${colors.brand.borderWeak}`,
    borderRadius: radius.xl,
    overflow: 'hidden',
}

const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md}px ${spacing.lg}px`,
}

const rowLabelStyle: React.CSSProperties = {
    fontSize: fontSize.base,
    color: colors.text.muted,
}

const rowValueStyle: React.CSSProperties = {
    fontSize: fontSize.base,
    color: colors.text.primary,
    textAlign: 'right',
    maxWidth: '60%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
}

const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: colors.brand.borderWeak,
    margin: `0 ${spacing.lg}px`,
}

const footerStyle: React.CSSProperties = {
    marginTop: 'auto',
    paddingTop: `${spacing.xxl}px`,
    paddingBottom: `${spacing.lg}px`,
}
