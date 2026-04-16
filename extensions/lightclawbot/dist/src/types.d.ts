/**
 * LightClaw OpenClaw Channel Plugin — 类型定义
 *
 * 用户实际消息格式：
 *   { msgId, from, to, content, files, timestamp }
 *
 * files 格式为 FileAttachment[]，每个文件包含 name, mimeType, bytes(data URL)。
 */
/** 用户上传的文件（files[] 数组中的元素） */
export interface FileAttachment {
    /** 文件名 */
    name: string;
    /** MIME 类型 */
    mimeType: string;
    /** base64 data URL（如 "data:text/plain;base64,..."） */
    bytes?: string;
    /** 远程文件 URI（如云端下载地址），与 bytes 二选一 */
    uri?: string;
}
/**
 * message:private 事件的 data 结构
 *
 * 入站（用户 → 插件）：{ msgId, from, to, content, files, timestamp }
 * 出站（插件 → 用户）：同结构，可附带 kind 用于流式/typing 控制
 */
export interface PrivateMessageData {
    /** 消息唯一 ID */
    msgId: string;
    /** 发送者 ID */
    from: string;
    /** 接收者 ID */
    to: string;
    /** 消息文本内容（仅发送文件时可为空字符串） */
    content: string;
    /** 消息时间戳（ms） */
    timestamp: number;
    /** 文件列表（{name, mimeType, bytes} 格式，bytes 为 data URL） */
    files?: FileAttachment[];
    /** 消息子类型：流式/typing 控制（出站使用） */
    kind?: "text" | "stream_chunk" | "stream_end" | "typing_start" | "typing_stop";
    /** 回复对应的原始消息 ID */
    replyToMsgId?: string;
    /**
     * 幂等键：标识每次独立的 emit 调用，前端据此去重。
     * 由 ReliableEmitter 在发送时自动注入，重试/重发时保持不变。
     */
    idempotencyKey?: string;
}
/** 原始配置（config.yaml 中的内容） */
export interface AssistantAccountConfig {
    /** @deprecated 不再使用，配置中只有 apiKeys */
    apiKey?: string;
    /** API Keys 列表（第一个作为主 key，用于获取 botId 等） */
    apiKeys?: string[];
    /** REST API 基础地址（用于 outbound 主动发送） */
    apiBaseUrl?: string;
    /** 是否启用 */
    enabled?: boolean;
    /** 账户名称 */
    name?: string;
    /** DM 策略 */
    dmPolicy?: "open" | "allowlist" | "disabled";
    /** 允许的用户 ID 列表（* 表示所有人） */
    allowFrom?: string[];
    /** 自定义系统提示词 */
    systemPrompt?: string;
}
/** 解析后的完整账户（含默认值和环境变量 fallback） */
export interface ResolvedAssistantAccount {
    accountId: string;
    /** 主 apiKey（获取 botId、默认文件操作等） */
    apiKey: string;
    /** 所有 apiKey（含主 key），用于 WS 多 key 认证 */
    allApiKeys: string[];
    apiBaseUrl: string;
    enabled: boolean;
    name?: string;
    dmPolicy: "open" | "allowlist" | "disabled";
    allowFrom: string[];
    systemPrompt?: string;
    secretSource: "config" | "env" | "none";
}
export interface GatewayContext {
    account: ResolvedAssistantAccount;
    abortSignal: AbortSignal;
    cfg: unknown;
    onReady?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
    /** 收到任何入站事件时调用，用于通知框架更新 lastEventAt，防止 health-monitor 误判 stale-socket */
    onEvent?: () => void;
    log?: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
        debug?: (msg: string) => void;
    };
}
/** 消息队列项 — 直接使用用户的 files[] 格式 */
export interface QueuedMessage {
    /** 发送者 ID */
    senderId: string;
    /** 消息文本 */
    text: string;
    /** 消息 ID */
    messageId: string;
    /** 文件附件（{name, mimeType, bytes} 格式） */
    files: FileAttachment[];
    /** 时间戳 */
    timestamp: number;
}
//# sourceMappingURL=types.d.ts.map