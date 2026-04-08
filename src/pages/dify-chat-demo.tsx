import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import dify, { DifyMessage } from '../utils/dify'
import { getBaziInfoStr, getCurrentTimeWuxing, getActiveBazi, onBaziChange, startBaziPolling } from '../utils/bazi-store'
import { TTSPlayer } from '../utils/volcan-tts'
import { getDeviceToken } from '../utils/device'
import { colors, fontSize, fontWeight, radius, spacing } from '../styles/tokens'
import { Conversation, saveConversation, listConversations, deleteConversation } from '../utils/local-db'
import { getAppConfig } from '../utils/api'

// Reason: 直接进入 demo 路由时 APP_CONFIG 可能尚未初始化，必须先 await 加载
async function getDifyConfig() {
    const cfg = await getAppConfig()
    return {
        apiKey: cfg.DIFY?.CHAT_DEMO_KEY ?? '',
        baseUrl: cfg.DIFY?.BASE_URL ?? 'https://dify-cn.noonwake.net/v1',
    }
}

const USER_ID = 'pi-demo-user'
const TTS_VOICE_TYPE = 'zh_female_xiaohe_uranus_bigtts'

type ChatMessage = {
    role: 'user' | 'assistant'
    content: string
    timestamp?: number
    difyMsgId?: string  // Dify 消息 ID，用于翻页加载历史
}

function formatTime(ts: number): string {
    const d = new Date(ts * 1000)
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
}

export default function DifyChatDemo(): ReactElement {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [streaming, setStreaming] = useState(false)
    const [conversationId, setConversationId] = useState<string | undefined>()
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [hasBazi, setHasBazi] = useState(!!getActiveBazi())
    const [ttsEnabled, setTtsEnabled] = useState(true)
    const [ttsPlaying, setTtsPlaying] = useState(false)
    const [showSidebar, setShowSidebar] = useState(false)
    const [conversationList, setConversationList] = useState<Conversation[]>([])
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const ttsPlayerRef = useRef<TTSPlayer | null>(null)

    // 确保八字轮询已启动（页面刷新直接进入时）
    useEffect(() => {
        if (getDeviceToken()) {
            startBaziPolling()
        }
        const unsub = onBaziChange(bazi => setHasBazi(!!bazi))
        refreshConversationList()
        return () => {
            unsub()
            ttsPlayerRef.current?.stop()
            abortRef.current?.abort()
        }
    }, [])

    const refreshConversationList = useCallback(async () => {
        const list = await listConversations()
        setConversationList(list)
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // 加载历史消息
    const loadHistory = async (firstId?: string) => {
        if (!conversationId) return
        setLoadingHistory(true)
        try {
            const res = await dify.getMessages(await getDifyConfig(), {
                conversationId,
                userId: USER_ID,
                firstId,
                limit: 20,
            })
            // 按 created_at 升序排列，确保时间从小到大
            const sorted = [...res.data].sort((a, b) => a.created_at - b.created_at)
            const historyMsgs: ChatMessage[] = sorted.flatMap((m: DifyMessage) => {
                const items: ChatMessage[] = []
                if (m.query) {
                    items.push({ role: 'user', content: m.query, timestamp: m.created_at, difyMsgId: m.id })
                }
                if (m.answer) {
                    items.push({ role: 'assistant', content: m.answer, timestamp: m.created_at, difyMsgId: m.id })
                }
                return items
            })
            if (firstId) {
                // 加载更多：插入到前面
                setMessages(prev => [...historyMsgs, ...prev])
            } else {
                setMessages(historyMsgs)
            }
            setHasMore(res.has_more)
        } catch (e) {
            console.error('加载历史失败:', e)
        } finally {
            setLoadingHistory(false)
        }
    }

    // conversationId 变化时加载历史
    useEffect(() => {
        if (conversationId) {
            loadHistory()
        }
    }, [conversationId])

    const handleSend = async () => {
        const query = input.trim()
        if (!query || loading) return

        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: query }])
        setLoading(true)
        setStreaming(true)

        // 添加空的 assistant 消息占位
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])

        const abortController = new AbortController()
        abortRef.current = abortController

        // 初始化 TTS 播放器
        let ttsPlayer: TTSPlayer | null = null
        if (ttsEnabled) {
            ttsPlayer = new TTSPlayer(TTS_VOICE_TYPE, setTtsPlaying)
            ttsPlayerRef.current = ttsPlayer
        }

        try {
            const stream = await dify.chat(await getDifyConfig(), {
                query,
                inputs: {
                    user_bazi_info: getBaziInfoStr(),
                    current_time: getCurrentTimeWuxing(),
                },
                user: USER_ID,
                response_mode: 'streaming',
                conversation_id: conversationId,
            }, abortController)

            let fullText = ''
            for await (const chunk of stream) {
                if (chunk.event === 'message' || chunk.event === 'agent_message') {
                    fullText += chunk.answer
                    ttsPlayer?.feed(chunk.answer)
                    setMessages(prev => {
                        const updated = [...prev]
                        updated[updated.length - 1] = { role: 'assistant', content: fullText }
                        return updated
                    })
                    if (!conversationId && chunk.conversation_id) {
                        setConversationId(chunk.conversation_id)
                        saveConversation(chunk.conversation_id, query.slice(0, 30))
                            .then(refreshConversationList)
                    }
                } else if (chunk.event === 'message_replace') {
                    fullText = chunk.answer
                    setMessages(prev => {
                        const updated = [...prev]
                        updated[updated.length - 1] = { role: 'assistant', content: fullText }
                        return updated
                    })
                } else if (chunk.event === 'message_end') {
                    if (!conversationId && chunk.conversation_id) {
                        setConversationId(chunk.conversation_id)
                        saveConversation(chunk.conversation_id, query.slice(0, 30))
                            .then(refreshConversationList)
                    }
                }
            }

            // 流结束，flush TTS 残留文本
            ttsPlayer?.flush()
            // 更新本地记录的时间
            if (conversationId) {
                saveConversation(conversationId).then(refreshConversationList)
            }
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') {
                // 用户中止
            } else {
                console.error('Chat error:', e)
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: '出错了，请重试' }
                    return updated
                })
            }
        } finally {
            setLoading(false)
            setStreaming(false)
            abortRef.current = null
        }
    }

    const handleStop = () => {
        abortRef.current?.abort()
        ttsPlayerRef.current?.stop()
    }

    const handleNewChat = () => {
        ttsPlayerRef.current?.stop()
        setMessages([])
        setConversationId(undefined)
        setHasMore(false)
        setShowSidebar(false)
    }

    const switchConversation = (convId: string) => {
        ttsPlayerRef.current?.stop()
        abortRef.current?.abort()
        setMessages([])
        setConversationId(convId)
        setHasMore(false)
        setShowSidebar(false)
    }

    const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
        e.stopPropagation()
        await deleteConversation(convId)
        await refreshConversationList()
        if (conversationId === convId) {
            handleNewChat()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div style={pageStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>Dify Chat Demo</h1>
                    {conversationId && (
                        <span style={convIdStyle}>会话: {conversationId.slice(0, 8)}...</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: `${spacing.sm}px`, alignItems: 'center' }}>
                    <button
                        style={historyBtnStyle}
                        onClick={() => setShowSidebar(v => !v)}
                        title="历史对话"
                    >
                        📋
                    </button>
                    <button
                        style={ttsEnabled ? ttsBtnActiveStyle : ttsBtnStyle}
                        onClick={() => {
                            if (ttsEnabled) ttsPlayerRef.current?.stop()
                            setTtsEnabled(v => !v)
                        }}
                        title={ttsEnabled ? '关闭语音' : '开启语音'}
                    >
                        {ttsPlaying ? '🔊' : ttsEnabled ? '🔈' : '🔇'}
                    </button>
                    <button style={newChatBtnStyle} onClick={handleNewChat}>
                        新对话
                    </button>
                </div>
            </div>

            {/* Conversation Sidebar */}
            {showSidebar && (
                <div style={sidebarStyle}>
                    <div style={sidebarHeaderStyle}>
                        <span style={{ fontSize: fontSize.base, fontWeight: fontWeight.medium }}>历史对话</span>
                        <button style={sidebarCloseBtnStyle} onClick={() => setShowSidebar(false)}>✕</button>
                    </div>
                    <div style={sidebarListStyle}>
                        {conversationList.length === 0 && (
                            <div style={{ padding: `${spacing.lg}px`, textAlign: 'center', color: colors.text.muted, fontSize: fontSize.sm }}>
                                暂无历史对话
                            </div>
                        )}
                        {conversationList.map(conv => (
                            <div
                                key={conv.conversationId}
                                style={conv.conversationId === conversationId ? convItemActiveStyle : convItemStyle}
                                onClick={() => switchConversation(conv.conversationId)}
                            >
                                <div style={convItemTitleStyle}>{conv.title}</div>
                                <div style={convItemMetaStyle}>
                                    <span>{new Date(conv.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    <button
                                        style={convDeleteBtnStyle}
                                        onClick={(e) => handleDeleteConversation(e, conv.conversationId)}
                                        title="删除"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div style={messagesContainerStyle}>
                {/* 加载更多 */}
                {hasMore && (
                    <div style={loadMoreStyle}>
                        <button
                            style={loadMoreBtnStyle}
                            onClick={() => {
                                const firstMsg = messages.find(m => m.difyMsgId)
                                loadHistory(firstMsg?.difyMsgId)
                            }}
                            disabled={loadingHistory}
                        >
                            {loadingHistory ? '加载中...' : '加载更多历史'}
                        </button>
                    </div>
                )}

                {messages.length === 0 && (
                    <div style={emptyStyle}>
                        <div style={emptyIconStyle}>💬</div>
                        <p style={emptyTextStyle}>发送消息开始对话</p>
                        <p style={emptyHintStyle}>
                            {hasBazi ? '已获取八字信息，可以问运势相关问题' : '未获取到八字信息，请先在 APP 中设置'}
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} style={msg.role === 'user' ? userMsgRowStyle : assistantMsgRowStyle}>
                        <div style={msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle}>
                            <div style={msgContentStyle}>{msg.content || (streaming && i === messages.length - 1 ? '...' : '')}</div>
                            {msg.timestamp && (
                                <div style={timestampStyle}>{formatTime(msg.timestamp)}</div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={inputAreaStyle}>
                <textarea
                    style={textareaStyle}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息... (Enter 发送)"
                    rows={1}
                    disabled={loading}
                />
                {streaming ? (
                    <button style={stopBtnStyle} onClick={handleStop}>
                        停止
                    </button>
                ) : (
                    <button
                        style={input.trim() ? sendBtnStyle : sendBtnDisabledStyle}
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                    >
                        发送
                    </button>
                )}
            </div>
        </div>
    )
}

/* ─── Styles ─── */

const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: colors.bg.base,
    color: colors.text.primary,
}

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderBottom: `1px solid ${colors.brand.border}`,
    flexShrink: 0,
}

const titleStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    margin: 0,
    color: colors.text.primary,
}

const convIdStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: colors.text.muted,
}

const newChatBtnStyle: React.CSSProperties = {
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.md,
    color: colors.brand.light,
    padding: `${spacing.xs}px ${spacing.md}px`,
    fontSize: fontSize.sm,
    cursor: 'pointer',
}

const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: `${spacing.lg}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.sm}px`,
}

const loadMoreStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: `${spacing.sm}px`,
}

const loadMoreBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.full,
    color: colors.text.muted,
    padding: `6px ${spacing.md}px`,
    fontSize: fontSize.xs,
    cursor: 'pointer',
}

const emptyStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: `${spacing.sm}px`,
}

const emptyIconStyle: React.CSSProperties = {
    fontSize: '48px',
    marginBottom: `${spacing.sm}px`,
}

const emptyTextStyle: React.CSSProperties = {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    margin: 0,
}

const emptyHintStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    margin: 0,
}

const userMsgRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
}

const assistantMsgRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-start',
}

const bubbleBase: React.CSSProperties = {
    maxWidth: '70%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    padding: `${spacing.sm}px ${spacing.md}px`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.6,
}

const userBubbleStyle: React.CSSProperties = {
    ...bubbleBase,
    background: colors.brand.main,
    color: colors.white,
    borderBottomRightRadius: radius.xs,
}

const assistantBubbleStyle: React.CSSProperties = {
    ...bubbleBase,
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    color: colors.text.primary,
    borderBottomLeftRadius: radius.xs,
}

const msgContentStyle: React.CSSProperties = {
    fontSize: fontSize.base,
}

const timestampStyle: React.CSSProperties = {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.4)',
    marginTop: '4px',
    textAlign: 'right',
}

const inputAreaStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${spacing.sm}px`,
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderTop: `1px solid ${colors.brand.border}`,
    flexShrink: 0,
    alignItems: 'flex-end',
}

const textareaStyle: React.CSSProperties = {
    flex: 1,
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.md,
    color: colors.text.primary,
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: fontSize.base,
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: '44px',
    maxHeight: '120px',
}

const sendBtnStyle: React.CSSProperties = {
    background: colors.brand.main,
    border: 'none',
    borderRadius: radius.md,
    color: colors.white,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    cursor: 'pointer',
    flexShrink: 0,
    height: '44px',
}

const sendBtnDisabledStyle: React.CSSProperties = {
    ...sendBtnStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
}

const stopBtnStyle: React.CSSProperties = {
    background: colors.btn.danger,
    border: `1px solid ${colors.btn.dangerBorder}`,
    borderRadius: radius.md,
    color: colors.btn.dangerText,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    cursor: 'pointer',
    flexShrink: 0,
    height: '44px',
}

const ttsBtnStyle: React.CSSProperties = {
    background: colors.bg.overlay,
    border: `1px solid ${colors.brand.border}`,
    borderRadius: radius.md,
    padding: `${spacing.xs}px ${spacing.sm}px`,
    fontSize: '20px',
    cursor: 'pointer',
    lineHeight: 1,
}

const ttsBtnActiveStyle: React.CSSProperties = {
    ...ttsBtnStyle,
    background: colors.bg.overlayActive,
    border: `1px solid ${colors.brand.borderStrong}`,
}

const historyBtnStyle: React.CSSProperties = {
    ...ttsBtnStyle,
}

const sidebarStyle: React.CSSProperties = {
    borderBottom: `1px solid ${colors.brand.border}`,
    background: colors.bg.overlay,
    maxHeight: '40vh',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
}

const sidebarHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.sm}px ${spacing.lg}px`,
    borderBottom: `1px solid ${colors.brand.border}`,
}

const sidebarCloseBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: colors.text.muted,
    fontSize: fontSize.base,
    cursor: 'pointer',
    padding: `${spacing.xs}px`,
}

const sidebarListStyle: React.CSSProperties = {
    overflowY: 'auto',
    flex: 1,
}

const convItemStyle: React.CSSProperties = {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    cursor: 'pointer',
    borderBottom: `1px solid ${colors.brand.border}`,
    transition: 'background 0.15s',
}

const convItemActiveStyle: React.CSSProperties = {
    ...convItemStyle,
    background: colors.bg.overlayActive,
    borderLeft: `3px solid ${colors.brand.main}`,
}

const convItemTitleStyle: React.CSSProperties = {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
}

const convItemMetaStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: '2px',
}

const convDeleteBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: colors.text.muted,
    fontSize: fontSize.xs,
    cursor: 'pointer',
    padding: '2px 4px',
    opacity: 0.6,
}
