/**
 * LightClaw — History Module Types
 *
 * 集中定义历史消息相关的类型，供 history/ 模块内部和外部统一使用。
 */
/** 文件附件信息（从消息文本中提取） */
export interface FileAttachmentInfo {
    /** 原始文件名 */
    name: string;
    /** MIME 类型 */
    mimeType?: string;
    /** 文件大小描述（如 "3.0KB"） */
    size?: string;
    /** 文件路径或 URI */
    uri?: string;
}
/** Cron 来源信息（标记消息来自哪个 cron 任务） */
export interface CronInfo {
    /** cron job ID */
    jobId: string;
    /** 任务名称（如 "每2分钟喝水提醒"） */
    name?: string;
    /** 本次运行的 session ID */
    runSessionId?: string;
}
/** 标准化后返回给前端的历史消息 */
export interface HistoryMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    timestamp?: number;
    /** 消息中包含的工具调用（可选） */
    toolCalls?: Array<{
        name: string;
        args?: string;
    }>;
    /** 消息中包含的工具结果（可选） */
    toolResult?: {
        toolCallId?: string;
        name?: string;
        output?: string;
    };
    /** AI 的思考过程（可选） */
    thinking?: string;
    /** 消息中包含的文件附件（可选） */
    files?: FileAttachmentInfo[];
    /** 压缩标记 */
    isCompaction?: boolean;
    /** 如果是 cron 消息，标识来源信息 */
    cronInfo?: CronInfo;
}
/** sessions.json 中每个条目的结构 */
export interface SessionStoreEntry {
    sessionId: string;
    sessionFile?: string;
    updatedAt?: number;
    label?: string;
    displayName?: string;
    channel?: string;
    chatType?: string;
}
/** 会话类型 */
export type SessionType = "direct" | "cron-base" | "cron-run";
/** Cron 会话信息 */
export interface CronSessionInfo {
    /** session key (e.g. "agent:main:cron:xxx:run:yyy") */
    sessionKey: string;
    /** session ID (即 JSONL 文件名前缀) */
    sessionId: string;
    /** cron job ID */
    cronJobId: string;
    /** 任务名称 (从 label 提取，如 "每2分钟喝水提醒") */
    cronName?: string;
    /** 最后更新时间 */
    updatedAt?: number;
}
/** 列出 session 时的条目类型（含 cron 类型标识） */
export interface SessionListEntry {
    sessionKey: string;
    sessionId: string;
    updatedAt?: number;
    label?: string;
    displayName?: string;
    channel?: string;
    /** 会话类型 */
    sessionType: SessionType;
    /** cron job ID (仅 cron 类型) */
    cronJobId?: string;
}
export interface ReadHistoryOptions {
    /** 最大返回条数，默认 200 */
    limit?: number;
    /** Agent ID，默认 "main" */
    agentId?: string;
    /** 只返回 user/assistant 消息（过滤 system/tool），默认 false */
    chatOnly?: boolean;
}
export interface ReadHistoryWithCronOptions extends ReadHistoryOptions {
    /** 是否包含 cron 消息，默认 true */
    includeCron?: boolean;
    /** 只包含指定 cron job ID 的消息 */
    cronJobIds?: string[];
}
export interface ReadHistoryTailOptions extends ReadHistoryOptions {
    /** 从末尾读取的最大字节数，默认 1MB */
    maxBytes?: number;
}
/** 原始 JSONL 行中 message.content 可能的结构 */
export type ContentEntry = {
    type?: string;
    text?: string;
    thinking?: string;
    thinkingSignature?: string;
    name?: string;
    id?: string;
    toolCallId?: string;
    tool_call_id?: string;
    toolName?: string;
    tool_name?: string;
    input?: unknown;
    arguments?: unknown;
    args?: unknown;
    output?: unknown;
    result?: unknown;
    content?: unknown;
    tool_use_id?: string;
    data?: string;
    uri?: string;
    mimeType?: string;
    mime_type?: string;
    fileName?: string;
    file_name?: string;
    filename?: string;
};
//# sourceMappingURL=types.d.ts.map