/**
 * Dify API 客户端 (浏览器端)
 * 从 src/back/llm/dify.ts 移植，适配浏览器环境
 */

// ========== Types ==========

type Int = number
type Long = number
type Float = number

export type DifyReqFile = {
    type: 'image'
    transfer_method: 'remote_url' | 'local_file'
    url?: string // remote_url
    upload_file_id?: string // local_file
}

export interface DifyReqConfig {
    apiKey: string
    baseUrl: string
}

interface BaseChatRequestBody {
    query: string
    inputs: Record<string, string>
    user: string
    conversation_id?: string
    files?: Array<DifyReqFile>
    auto_generate_name?: boolean
}

interface StreamingChatRequestBody extends BaseChatRequestBody {
    response_mode: 'streaming'
}

interface BlockingChatRequestBody extends BaseChatRequestBody {
    response_mode: 'blocking'
}

type Metadata = {
    usage: Record<string, number | string>
    retriever_resources: Record<string, number | string>
}

interface ChatCompletionResponse {
    message_id: string
    conversation_id: string
    mode: 'chat'
    answer: string
    metadata: Metadata
    created_at: number
}

export interface MessageChunk {
    event: 'message'
    task_id: string
    message_id: string
    conversation_id: string
    answer: string
    created_at: number
}

export interface AgentMessageChunk {
    event: 'agent_message'
    task_id: string
    message_id: string
    conversation_id: string
    answer: string
    created_at: number
}

interface AgentThoughtChunk {
    event: 'agent_thought'
    id: string
    task_id: string
    message_id: string
    position: number
    thought: string
    observation: string
    tool: string
    tool_input: string
    created_at: number
    message_files: Array<string>
    conversation_id: string
}

interface MessageFileChunk {
    event: 'message_file'
    id: string
    type: 'image'
    belongs_to: 'assistant'
    url: string
    conversation_id: string
}

export interface MessageEndChunk {
    event: 'message_end'
    task_id: string
    message_id: string
    conversation_id: string
    metadata: Metadata
}

export interface MessageReplaceChunk {
    event: 'message_replace'
    task_id: string
    message_id: string
    conversation_id: string
    answer: string
    created_at: number
}

interface MessageTTSChunk {
    event: 'tts_message'
    task_id: string
    message_id: string
    audio: string
    created_at: string
}

interface MessageTTSEndChunk {
    event: 'tts_message_end'
    task_id: string
    message_id: string
    audio: string
    created_at: string
}

interface ErrorChunk {
    event: 'error'
    task_id: string
    message_id: string
    status: number
    code: string
    message: string
}

interface PingChunk {
    event: 'ping'
}

export type ChunkChatCompletionResponse = MessageChunk
    | AgentMessageChunk
    | AgentThoughtChunk
    | MessageFileChunk
    | MessageEndChunk
    | MessageTTSChunk
    | MessageTTSEndChunk
    | MessageReplaceChunk
    | ErrorChunk
    | PingChunk

// ========== Workflow Types ==========

interface WorkflowReqBody {
    inputs: Record<string, string>
    user: string
    files: Array<{
        type: 'document' | 'image' | 'audio' | 'video'
        transfer_method: 'remote_url' | 'local_file'
        url?: string
        upload_file_id?: string
    }>
}

interface WorkflowReqBodyBlock extends WorkflowReqBody {
    response_mode: 'blocking'
}

interface WorkflowReqBodyStream extends WorkflowReqBody {
    response_mode: 'streaming'
}

type WorkflowStatus = 'running' | 'succeeded' | 'failed' | 'stopped'

interface WorkflowRes {
    workflow_run_id: string
    task_id: string
    data: {
        id: string
        workflow_id: string
        status: WorkflowStatus
        outputs: Record<string, string>
        error: string
        elapsed_time: Float
        total_tokens: Int
        total_steps: Int
        created_at: Long
        finished_at: Long
    }
}

interface WorkflowStartedChunk {
    event: 'workflow_started'
    task_id: string
    workflow_run_id: string
    data: {
        id: string
        workflow_id: string
        sequence_number: Int
        created_at: Long
    }
}

interface WorkflowNodeStartedChunk {
    event: 'node_started'
    task_id: string
    workflow_run_id: string
    data: {
        id: string
        node_id: string
        node_type: string
        title: string
        index: Int
        predecessor_node_id: string
        inputs: Record<string, any>
        created_at: Long
    }
}

interface WorkflowNodeFinishedChunk {
    event: 'node_finished'
    task_id: string
    workflow_run_id: string
    data: {
        id: string
        node_id: string
        index: Int
        predecessor_node_id: string
        inputs: Record<string, any>
        process_data: Record<string, any>
        outputs: Record<string, any>
        status: WorkflowStatus
        error: string
        elapsed_time: Float
        execution_metadata: {
            total_tokens: Int
            total_price: number
            currency: string
        }
        created_at: Long
    }
}

interface WorkflowFinishedChunk {
    event: 'workflow_finished'
    task_id: string
    workflow_run_id: string
    data: {
        id: string
        workflow_id: string
        status: WorkflowStatus
        outputs: Record<string, any>
        error: string
        elapsed_time: Float
        total_tokens: Int
        total_steps: Int
        created_at: Long
        finished_at: Long
    }
}

export type WorkflowResChunk = WorkflowStartedChunk
    | WorkflowNodeStartedChunk
    | WorkflowNodeFinishedChunk
    | WorkflowFinishedChunk
    | MessageTTSChunk
    | MessageTTSEndChunk
    | PingChunk

// ========== Completion Messages Types ==========

export interface DifyCompletionMessagesReqBody {
    inputs: Record<string, string>
    user: string
    files: Array<DifyReqFile>
}

interface CompletionMessagesReqBodyBlock extends DifyCompletionMessagesReqBody {
    response_mode: 'blocking'
}

interface CompletionMessagesReqBodyStream extends DifyCompletionMessagesReqBody {
    response_mode: 'streaming'
}

interface CompletionMessagesRes extends Omit<ChatCompletionResponse, 'conversation_id'> {
}

type CompletionMessagesChunk = Omit<MessageChunk, 'conversation_id'>
    | Omit<MessageEndChunk, 'conversation_id'>
    | MessageTTSChunk
    | MessageTTSEndChunk
    | Omit<MessageReplaceChunk, 'conversation_id'>
    | ErrorChunk
    | PingChunk

// ========== Helpers ==========

const MAX_DIFY_IMAGES = 4

function limitImageFiles<T extends { type: string }>(files: T[] | undefined): T[] | undefined {
    if (!files) return files
    const imageCount = files.filter(f => f.type === 'image').length
    if (imageCount <= MAX_DIFY_IMAGES) return files
    console.warn(`Dify 图片数量超过限制，截取最后4张 (total: ${imageCount})`)
    let kept = 0
    const reversed = [...files].reverse()
    const result = reversed.filter(f => {
        if (f.type !== 'image') return true
        if (kept < MAX_DIFY_IMAGES) { kept++; return true }
        return false
    })
    return result.reverse()
}

const DIFY_IMAGE_COMPRESS = 'resize,l_1600/format,webp/quality,q_80'

function compressDifyImageFiles<T extends { type: string, transfer_method?: string, url?: string }>(files: T[] | undefined): T[] | undefined {
    if (!files) return files
    return files.map(f => {
        if (f.type !== 'image' || f.transfer_method !== 'remote_url' || !f.url) return f
        const url = f.url
        if (url.includes('x-oss-process=')) {
            return { ...f, url: `${url}/${DIFY_IMAGE_COMPRESS}` }
        }
        return { ...f, url: `${url}?x-oss-process=image/${DIFY_IMAGE_COMPRESS}` }
    })
}

/**
 * Normalize Dify streaming chunks.
 * Dify may incorrectly emit text chunks with event: "message_file"
 * while still carrying a normal answer payload.
 */
export function normalizeDifyStreamChunk<T>(chunk: T): T {
    const anyChunk = chunk as any
    if (anyChunk && typeof anyChunk === 'object') {
        const event = anyChunk.event
        if (event === 'message_file' && typeof anyChunk.answer === 'string') {
            return { ...anyChunk, event: 'message' } as T
        }
    }
    return chunk
}

// ========== Browser SSE Stream Parser ==========

async function* parseBrowserSSEStream<T>(
    response: Response,
    abortController?: AbortController,
): AsyncGenerator<T> {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent: string | null = null
    let dataLines: string[] = []

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const rawLine of lines) {
                const line = rawLine.replace(/\r$/, '')

                if (!line) {
                    // 空行 = 事件结束
                    if (dataLines.length > 0) {
                        const dataStr = dataLines.join('\n')
                        dataLines = []

                        if (dataStr.startsWith('[DONE]')) {
                            return
                        }

                        try {
                            const data = JSON.parse(dataStr)
                            if (currentEvent === 'ping' || data.event === 'ping') {
                                currentEvent = null
                                continue
                            }
                            yield normalizeDifyStreamChunk(data) as T
                        } catch (e) {
                            console.error('SSE JSON parse error:', dataStr)
                        }
                        currentEvent = null
                    }
                    continue
                }

                if (line.startsWith(':')) continue // comment

                if (line.startsWith('event:')) {
                    currentEvent = line.slice(6).trim()
                } else if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trimStart())
                }
            }
        }

        // 处理残留 buffer
        if (dataLines.length > 0) {
            const dataStr = dataLines.join('\n')
            if (!dataStr.startsWith('[DONE]')) {
                try {
                    yield normalizeDifyStreamChunk(JSON.parse(dataStr)) as T
                } catch {
                    // ignore
                }
            }
        }
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        throw e
    } finally {
        reader.releaseLock()
    }
}

// ========== API Functions ==========

async function chat(config: DifyReqConfig, body: BlockingChatRequestBody): Promise<ChatCompletionResponse>
async function chat(config: DifyReqConfig, body: StreamingChatRequestBody, abortController?: AbortController): Promise<AsyncGenerator<ChunkChatCompletionResponse>>
async function chat(config: DifyReqConfig, body: BlockingChatRequestBody | StreamingChatRequestBody, abortController?: AbortController): Promise<ChatCompletionResponse | AsyncGenerator<ChunkChatCompletionResponse>> {
    const { apiKey, baseUrl } = config
    body.files = compressDifyImageFiles(limitImageFiles(body.files))
    const streaming = body.response_mode === 'streaming'

    try {
        const response = await fetch(`${baseUrl}/chat-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: abortController?.signal,
        })

        if (!response.ok) {
            const errBody = await response.text().catch(() => '')
            throw new Error(`Dify chat error: HTTP ${response.status} ${errBody}`)
        }

        if (streaming) {
            return parseBrowserSSEStream<ChunkChatCompletionResponse>(response, abortController)
        } else {
            return await response.json() as ChatCompletionResponse
        }
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        console.error('dify chat-messages 异常:', e)
        throw e
    }
}

async function completionMessages(config: DifyReqConfig, body: CompletionMessagesReqBodyBlock): Promise<CompletionMessagesRes>
async function completionMessages(config: DifyReqConfig, body: CompletionMessagesReqBodyStream): Promise<AsyncGenerator<CompletionMessagesChunk>>
async function completionMessages(config: DifyReqConfig, body: CompletionMessagesReqBodyBlock | CompletionMessagesReqBodyStream): Promise<CompletionMessagesRes | AsyncGenerator<CompletionMessagesChunk>> {
    const { apiKey, baseUrl } = config
    body.files = compressDifyImageFiles(limitImageFiles(body.files) ?? body.files) ?? body.files

    try {
        const streaming = body.response_mode === 'streaming'
        const response = await fetch(`${baseUrl}/completion-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const errBody = await response.text().catch(() => '')
            throw new Error(`Dify completion error: HTTP ${response.status} ${errBody}`)
        }

        if (streaming) {
            return parseBrowserSSEStream<CompletionMessagesChunk>(response)
        } else {
            return await response.json() as CompletionMessagesRes
        }
    } catch (e) {
        console.error('dify completion-messages 异常:', e)
        throw e
    }
}

async function runWorkflow(config: DifyReqConfig, body: WorkflowReqBodyBlock): Promise<WorkflowRes>
async function runWorkflow(config: DifyReqConfig, body: WorkflowReqBodyStream, abortController?: AbortController): Promise<AsyncGenerator<WorkflowResChunk>>
async function runWorkflow(config: DifyReqConfig, body: WorkflowReqBodyBlock | WorkflowReqBodyStream, abortController?: AbortController): Promise<WorkflowRes | AsyncGenerator<WorkflowResChunk>> {
    const { apiKey, baseUrl } = config
    body.files = compressDifyImageFiles(limitImageFiles(body.files) ?? body.files) ?? body.files

    try {
        const streaming = body.response_mode === 'streaming'
        const response = await fetch(`${baseUrl}/workflows/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: abortController?.signal,
        })

        if (!response.ok) {
            const errBody = await response.text().catch(() => '')
            throw new Error(`Dify workflow error: HTTP ${response.status} ${errBody}`)
        }

        if (streaming) {
            return parseBrowserSSEStream<WorkflowResChunk>(response, abortController)
        } else {
            return await response.json() as WorkflowRes
        }
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        console.error('dify workflows/run 异常:', e)
        throw e
    }
}

async function getMessageSuggestions({ messageId, apiKey, userId, baseUrl }: {
    messageId: string
    userId: string
} & DifyReqConfig): Promise<string[] | undefined> {
    const response = await fetch(
        `${baseUrl}/messages/${messageId}/suggested?user=${userId}`,
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
        },
    )
    const data = await response.json()
    const suggestions = data?.data
    if (Array.isArray(suggestions)) {
        return suggestions
    }
    return []
}

async function getAgentParameters({ apiKey, userId, baseUrl }: {
    userId: string
} & DifyReqConfig): Promise<{
    opening_statement: string
    suggested_questions: string[]
} | undefined> {
    const response = await fetch(
        `${baseUrl}/parameters?user=${userId}`,
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
        },
    )
    return await response.json()
}

interface DifyBotInfo {
    name: string
    description: string
    tags: Array<string>
}

async function getBotInfo(userId: string, config: DifyReqConfig): Promise<DifyBotInfo | undefined> {
    const { apiKey, baseUrl } = config
    const response = await fetch(`${baseUrl}/info?user=${userId}`, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })
    return await response.json()
}

// ========== Messages History ==========

export interface DifyMessageFile {
    id: string
    type: string
    url: string
    belongs_to: string
}

export interface DifyAgentThought {
    id: string
    message_id: string
    position: number
    thought: string
    observation: string
    tool: string
    tool_input: string
    created_at: number
    files: string[]
}

export interface DifyMessage {
    id: string
    conversation_id: string
    inputs: Record<string, any>
    query: string
    answer: string
    message_files: DifyMessageFile[]
    feedback: { rating: string } | null
    retriever_resources: any[]
    agent_thoughts: DifyAgentThought[]
    created_at: number
}

export interface DifyMessagesResponse {
    data: DifyMessage[]
    has_more: boolean
    limit: number
}

async function getMessages(config: DifyReqConfig, params: {
    conversationId: string
    userId: string
    firstId?: string
    limit?: number
}): Promise<DifyMessagesResponse> {
    const { apiKey, baseUrl } = config
    const searchParams = new URLSearchParams({
        conversation_id: params.conversationId,
        user: params.userId,
    })
    if (params.firstId) searchParams.set('first_id', params.firstId)
    if (params.limit) searchParams.set('limit', String(params.limit))

    const response = await fetch(`${baseUrl}/messages?${searchParams}`, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })

    if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        throw new Error(`Dify getMessages error: HTTP ${response.status} ${errBody}`)
    }

    return await response.json()
}

// ========== Conversations ==========

export interface DifyConversation {
    id: string
    name: string
    inputs: Record<string, any>
    introduction: string
    created_at: number
    updated_at: number
}

export interface DifyConversationsResponse {
    data: DifyConversation[]
    has_more: boolean
    limit: number
}

async function getConversations(config: DifyReqConfig, params: {
    userId: string
    lastId?: string
    limit?: number
    sortBy?: 'created_at' | '-created_at' | 'updated_at' | '-updated_at'
}): Promise<DifyConversationsResponse> {
    const { apiKey, baseUrl } = config
    const searchParams = new URLSearchParams({
        user: params.userId,
    })
    if (params.lastId) searchParams.set('last_id', params.lastId)
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.sortBy) searchParams.set('sort_by', params.sortBy)

    const response = await fetch(`${baseUrl}/conversations?${searchParams}`, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })

    if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        throw new Error(`Dify getConversations error: HTTP ${response.status} ${errBody}`)
    }

    return await response.json()
}

async function stopTask(config: DifyReqConfig, type: 'chat' | 'completion' | 'workflow', taskId: string, userId: string): Promise<void> {
    const { apiKey, baseUrl } = config
    let url: string | undefined
    if (type === 'chat') {
        url = `${baseUrl}/chat-messages/${taskId}/stop`
    } else if (type === 'workflow') {
        url = `${baseUrl}/workflows/tasks/${taskId}/stop`
    } else if (type === 'completion') {
        url = `${baseUrl}/completion-messages/${taskId}/stop`
    }
    if (!url) return

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ user: userId }),
        })
    } catch (e) {
        console.error('stop dify task error:', e)
    }
}

// ========== Export ==========

const dify = {
    chat,
    getBotInfo,
    completionMessages,
    runWorkflow,
    getMessages,
    getConversations,
    getMessageSuggestions,
    getAgentParameters,
    stopTask,

    DEFAULT_BASE_URL: 'https://dify-cn.noonwake.net/v1',
}

export default dify
