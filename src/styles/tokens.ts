/**
 * Pi 桌面端公用样式 Token
 * 颜色对齐 noonwake.ai 品牌色系
 */

// ── 原始基础色（hex）──────────────────────────────────────────────
// 所有透明度变体都通过 withAlpha 生成，避免到处散落 rgba(...)
const RAW = {
    brand:      '#c8a84b',   // 品牌主金
    brandLight: '#f0dfa0',   // 品牌淡金
    brandDark:  '#1e1405',   // 品牌深金
    brandGray:  '#9a8860',   // 品牌暖灰金
    warmWhite:  '#f8f4ea',   // 暖白（主文字）
    warmGray:   '#a89b76',   // 暖灰金（次要文字）
}

/** 通用透明度函数：传入任意 6 位 hex 和 alpha，返回 rgba 字符串 */
export function withAlpha(hex: string, alpha: number): string {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

/** 暖白透明色（向后兼容） */
export const whiteAlpha = (alpha: number) => withAlpha(RAW.warmWhite, alpha)

/** 品牌金透明色（向后兼容） */
export const brandAlpha = (alpha: number) => withAlpha(RAW.brand, alpha)


export const colors = {
    // 背景层级
    bg: {
        base:          '#000000',
        surface:       '#0f0d08',
        overlay:       withAlpha(RAW.brand, 0.082),    // 金色叠加卡片
        overlayHover:  withAlpha(RAW.brand, 0.125),    // hover 态
        overlayActive: withAlpha(RAW.brand, 0.19),     // active / 选中态
    },

    // 品牌色
    brand: {
        main:         RAW.brand,
        light:        RAW.brandLight,
        dark:         RAW.brandDark,
        gray:         RAW.brandGray,
        border:       withAlpha(RAW.brand, 0.15),
        borderStrong: withAlpha(RAW.brand, 0.35),
        borderWeak:   withAlpha(RAW.brand, 0.085),
    },

    // 文字
    text: {
        primary:   RAW.warmWhite,
        secondary: withAlpha(RAW.warmGray, 0.8),
        muted:     withAlpha(RAW.warmGray, 0.5),
        accent:    RAW.brandLight,
        onBright:  RAW.warmWhite,
        disabled:  withAlpha(RAW.warmGray, 0.3),
    },

    fortune: {
        love:     '#f472b6',   // 桃花 粉
        career:   '#34d399',   // 事业 绿
        wealth:   '#f5a623',   // 财运 黄橙
        study:    '#d7c8fd',   // 学业 淡紫
        blessing: '#80f3f5',   // 祈福 青
        good:     '#80f3f5',   // 宜（青）
        bad:      '#f87171',   // 忌（红）
        special:  RAW.brandLight,  // 特殊日 淡金
    },

    // 按钮
    btn: {
        primary:         RAW.brand,
        primaryHover:    withAlpha(RAW.brand, 0.85),
        secondary:       withAlpha(RAW.warmWhite, 0.08),
        secondaryBorder: withAlpha(RAW.warmWhite, 0.15),
        danger:          withAlpha('#f87171', 0.2),
        dangerBorder:    withAlpha('#f87171', 0.45),
        dangerText:      '#f87171',
    },

    // 通用
    white:     '#ffffff',
    black:     '#000000',
    warn:      '#f87171',                              // 警示红
    highlight: '#80f3f5',                              // 装饰高光青
}


export const radius = {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
    full: '9999px',
}

export const spacing = {
    xs: 8,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 48,
    xxl: 64,
    xxxl: 80,
}

export const fontSize = {
    xs: '14px',
    sm: '16px',
    base: '18px',
    md: '20px',
    lg: '24px',
    xl: '28px',
    xxl: '36px',
    hero: '120px',   // 时钟大字
}

export const fontWeight = {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
}

export const lineHeight = {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
}

// 常用卡片样式
export const card = {
    base: {
        background: colors.bg.overlay,
        border: `1px solid ${colors.brand.border}`,
        borderRadius: radius.xl,
        padding: `${spacing.lg}px`,
    } as React.CSSProperties,
    surface: {
        background: colors.bg.surface,
        border: `1px solid ${colors.brand.borderWeak}`,
        borderRadius: radius.xl,
        padding: `${spacing.lg}px`,
    } as React.CSSProperties,
}

// 常用按钮样式
export const btn = {
    primary: {
        background: colors.btn.primary,
        border: 'none',
        borderRadius: radius.md,
        color: colors.white,
        cursor: 'pointer',
        fontSize: fontSize.md,
        fontWeight: fontWeight.medium,
    } as React.CSSProperties,
    secondary: {
        background: colors.btn.secondary,
        border: `1px solid ${colors.btn.secondaryBorder}`,
        borderRadius: radius.md,
        color: colors.text.primary,
        cursor: 'pointer',
        fontSize: fontSize.base,
    } as React.CSSProperties,
    danger: {
        background: colors.btn.danger,
        border: `1px solid ${colors.btn.dangerBorder}`,
        borderRadius: radius.md,
        color: colors.btn.dangerText,
        cursor: 'pointer',
        fontSize: fontSize.base,
    } as React.CSSProperties,
}
