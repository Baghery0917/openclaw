/**
 * LightClaw — 账户配置解析
 *
 * 从 OpenClaw openclaw.json 中读取 channels.lightclawbot 段，
 * 支持多账户、环境变量 fallback。
 *
 * 配置示例 (~/.openclaw/openclaw.json):
 * ```json
"channels": {
    "lightclawbot": {
      "apiKeys": ["key-1", "key-2"],
      "enabled": true
    }
}
 * ```
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { AssistantAccountConfig, ResolvedAssistantAccount } from "./types.js";
export declare const CHANNEL_KEY = "lightclawbot";
export declare const DEFAULT_ACCOUNT_ID = "default";
/** 核心服务域名 */
export declare const DOMAIN = "lightai.cloud.tencent.com";
/** WebSocket 连接地址 */
export declare const WS_URL = "wss://lightai.cloud.tencent.com";
/** HTTP API 基础地址 */
export declare const API_BASE_URL = "https://lightai.cloud.tencent.com";
/** 文件存储相关配置 */
export declare const COS_BASE_URL = "https://lightai.cloud.tencent.com";
/** Socket.IO 连接路径 */
export declare const SOCKET_PATH = "/claw-socket";
/** Socket.IO 重连策略 */
export declare const SOCKET_RECONNECTION_DELAY = 1000;
export declare const SOCKET_RECONNECTION_DELAY_MAX = 30000;
export declare const SOCKET_RECONNECTION_ATTEMPTS: number;
/** 产品标识 header 值，用于 x-product header */
export declare const X_PRODUCT = "channel";
/** 构建通用认证 headers */
export declare function buildAuthHeaders(apiKey: string): Record<string, string>;
/** WS 多 key 认证 headers（authorizations 为 JSON 数组字符串，不带 Bearer） */
export declare function buildMultiAuthHeaders(apiKeys: string[]): Record<string, string | string[]>;
/** 设置 apiKeyMap（gateway 启动时调用） */
export declare function setApiKeyMap(map: Map<string, string>, defaultApiKey: string): void;
/** 记录 sessionKey → apiKey 映射（inbound 处理消息时调用） */
export declare function setSessionApiKey(sessionKey: string, apiKey: string): void;
/**
 * 统一的 apiKey 解析入口。
 *
 * 优先级：
 *   1. sessionKey → 直查 sessionKeyToApiKey 映射
 *   2. senderId (uin) → 直查 globalApiKeyMap
 *   3. sessionKey 中解析 uin → 再查 globalApiKeyMap（兜底）
 *   4. globalDefaultApiKey
 *
 * 全链路统一使用此函数获取 apiKey，避免 inbound / tool 各自维护不同的获取逻辑。
 */
export declare function resolveEffectiveApiKey(params: {
    sessionKey?: string;
    senderId?: string;
}): string;
/**
 * 从 sessionKey 中提取 uin（peer ID）。
 *
 * 框架生成的 sessionKey 格式取决于 dmScope 配置：
 *   - per-channel-peer:         "agent:<agentId>:<channel>:direct:<peerId>"
 *   - per-account-channel-peer: "agent:<agentId>:<channel>:<accountId>:direct:<peerId>"
 *   - per-peer:                 "agent:<agentId>:direct:<peerId>"
 *   - main (默认):              "agent:<agentId>:main"  ← 不含 peerId
 *
 * 也兼容旧格式 "lightclawbot:dm:<peerId>"。
 */
export declare function extractUinFromSessionKey(sessionKey: string): string | undefined;
/** 获取当前用户信息（用于提取 botId） */
export declare const API_PATH_USER_CURRENT = "/user/current";
/** 文件上传接口 */
export declare const API_PATH_UPLOAD = "/drive/save";
/** 文件下载接口 */
export declare const API_PATH_DOWNLOAD = "/drive/preview";
export declare const EVENT_MESSAGE_PRIVATE = "message:private";
export declare const EVENT_HISTORY_REQUEST = "message:history:request";
export declare const EVENT_HISTORY_RESPONSE = "message:history:response";
export declare const EVENT_SESSIONS_REQUEST = "sessions:request";
export declare const EVENT_SESSIONS_RESPONSE = "sessions:response";
/** AI 回复超时时间（ms） */
export declare const REPLY_TIMEOUT = 120000;
/** 文件上传超时时间（ms） */
export declare const UPLOAD_TIMEOUT = 120000;
/** 媒体文件最大字节数（100MB） */
export declare const MEDIA_MAX_BYTES: number;
/** 消息队列最大容量 */
export declare const MESSAGE_QUEUE_SIZE = 1000;
/** 队列警告阈值 */
export declare const MESSAGE_QUEUE_WARN_THRESHOLD = 800;
/** 队列轮询间隔（ms） */
export declare const QUEUE_POLL_INTERVAL = 200;
/** 消息去重 TTL（ms） */
export declare const DEDUP_TTL: number;
/** 去重 Map 最大容量 */
export declare const DEDUP_MAX_SIZE = 5000;
/** History 请求防抖间隔（ms） */
export declare const HISTORY_THROTTLE_MS = 200;
/** 节流 Map 最大容量 */
export declare const HISTORY_THROTTLE_MAX_SIZE = 1000;
/** Health-monitor 心跳间隔（ms），需小于框架的 stale-socket 阈值（30 分钟） */
export declare const HEALTH_HEARTBEAT_INTERVAL: number;
/** 每个 account 最大缓冲消息数 */
export declare const MAX_PENDING_MESSAGES = 200;
/** 历史消息默认请求条数 */
export declare const DEFAULT_HISTORY_LIMIT = 100;
/** 文本分块最大长度 */
export declare const TEXT_CHUNK_LIMIT = 4096;
/** ACK 等待超时（ms） */
export declare const EMIT_ACK_TIMEOUT = 5000;
/** 最大重试次数 */
export declare const EMIT_MAX_RETRIES = 3;
/** 重试基础延迟（ms），指数退避: delay = base * 2^retryCount + jitter */
export declare const EMIT_RETRY_BASE_DELAY = 2000;
/** 重试最大延迟（ms） */
export declare const EMIT_RETRY_MAX_DELAY = 15000;
/** 最大待确认消息数，超出时丢弃最早的 */
export declare const EMIT_PENDING_MAX = 500;
/** 列出所有账户 ID */
export declare function listAccountIds(cfg: OpenClawConfig): string[];
/** 解析单个账户 */
export declare function resolveAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedAssistantAccount;
/** 获取默认账户 ID */
export declare function defaultAccountId(_cfg: OpenClawConfig): string;
/** 应用账户配置（setup 命令使用） */
export declare function applyAccountConfig(cfg: OpenClawConfig, accountId: string, updates: Partial<AssistantAccountConfig>): OpenClawConfig;
//# sourceMappingURL=config.d.ts.map