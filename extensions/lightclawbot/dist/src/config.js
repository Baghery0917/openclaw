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
export const CHANNEL_KEY = "lightclawbot";
export const DEFAULT_ACCOUNT_ID = "default";
// 环境变量 key
const ENV_API_KEY = "LIGHTCLAW_API_KEY";
const ENV_API_BASE_URL = "LIGHTCLAW_API_BASE_URL";
// ============================================================
// 域名 & URL 配置
// ============================================================
/** 核心服务域名 */
export const DOMAIN = "lightai.cloud.tencent.com";
/** WebSocket 连接地址 */
export const WS_URL = `wss://${DOMAIN}`;
/** HTTP API 基础地址 */
export const API_BASE_URL = `https://${DOMAIN}`;
/** 文件存储相关配置 */
export const COS_BASE_URL = `https://${DOMAIN}`;
// ============================================================
// Socket.IO 配置
// ============================================================
/** Socket.IO 连接路径 */
export const SOCKET_PATH = "/claw-socket";
/** Socket.IO 重连策略 */
export const SOCKET_RECONNECTION_DELAY = 1000;
export const SOCKET_RECONNECTION_DELAY_MAX = 30000;
export const SOCKET_RECONNECTION_ATTEMPTS = Infinity;
// ============================================================
// HTTP Header 配置
// ============================================================
/** 产品标识 header 值，用于 x-product header */
export const X_PRODUCT = "channel";
/** 构建通用认证 headers */
export function buildAuthHeaders(apiKey) {
    return {
        authorization: `Bearer ${apiKey}`,
        "x-product": X_PRODUCT,
    };
}
/** WS 多 key 认证 headers（authorizations 为 JSON 数组字符串，不带 Bearer） */
export function buildMultiAuthHeaders(apiKeys) {
    return {
        authorizations: apiKeys.map(key => `Bearer ${key}`),
        "x-product": X_PRODUCT,
    };
}
// ============================================================
// 全局 uin → apiKey 映射管理
// ============================================================
/** 全局 uin→apiKey 映射（gateway 启动时构建，工具执行时读取） */
let globalApiKeyMap = new Map();
let globalDefaultApiKey = "";
/** sessionKey → apiKey 直接映射（inbound 处理时写入，tool 执行时读取） */
const sessionKeyToApiKey = new Map();
/** 设置 apiKeyMap（gateway 启动时调用） */
export function setApiKeyMap(map, defaultApiKey) {
    globalApiKeyMap = map;
    globalDefaultApiKey = defaultApiKey;
}
/** 记录 sessionKey → apiKey 映射（inbound 处理消息时调用） */
export function setSessionApiKey(sessionKey, apiKey) {
    sessionKeyToApiKey.set(sessionKey.toLowerCase(), apiKey);
}
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
export function resolveEffectiveApiKey(params) {
    // 1. 通过 sessionKey 直接查映射（tool 执行时的主要路径）
    if (params.sessionKey) {
        const apiKey = sessionKeyToApiKey.get(params.sessionKey.toLowerCase());
        if (apiKey)
            return apiKey;
    }
    // 2. 通过 senderId (uin) 查映射（inbound 处理时的主要路径）
    if (params.senderId) {
        const apiKey = globalApiKeyMap.get(params.senderId);
        if (apiKey)
            return apiKey;
    }
    // 3. 从 sessionKey 中解析 uin，再查 globalApiKeyMap（兜底）
    if (params.sessionKey) {
        const uin = extractUinFromSessionKey(params.sessionKey);
        if (uin) {
            const apiKey = globalApiKeyMap.get(uin);
            if (apiKey)
                return apiKey;
        }
    }
    // 4. 默认 apiKey
    return globalDefaultApiKey;
}
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
export function extractUinFromSessionKey(sessionKey) {
    if (!sessionKey)
        return undefined;
    const lower = sessionKey.toLowerCase();
    // 新格式：查找 ":direct:<peerId>" 片段
    const directIdx = lower.indexOf(":direct:");
    if (directIdx >= 0) {
        const afterDirect = sessionKey.slice(directIdx + ":direct:".length);
        // peerId 可能后面还跟着 ":thread:xxx" 等后缀，取第一段
        const peerId = afterDirect.split(":")[0];
        return peerId || undefined;
    }
    // 旧格式兼容：lightclawbot:dm:<peerId>
    const legacyPrefix = `${CHANNEL_KEY}:dm:`;
    if (lower.startsWith(legacyPrefix.toLowerCase())) {
        return sessionKey.slice(legacyPrefix.length) || undefined;
    }
    return undefined;
}
// ============================================================
// API 路径配置
// ============================================================
/** 获取当前用户信息（用于提取 botId） */
export const API_PATH_USER_CURRENT = "/user/current";
/** 文件上传接口 */
export const API_PATH_UPLOAD = "/drive/save";
/** 文件下载接口 */
export const API_PATH_DOWNLOAD = "/drive/preview";
// ============================================================
// Socket.IO 事件名
// ============================================================
export const EVENT_MESSAGE_PRIVATE = "message:private";
export const EVENT_HISTORY_REQUEST = "message:history:request";
export const EVENT_HISTORY_RESPONSE = "message:history:response";
export const EVENT_SESSIONS_REQUEST = "sessions:request";
export const EVENT_SESSIONS_RESPONSE = "sessions:response";
// ============================================================
// 超时 & 限制配置
// ============================================================
/** AI 回复超时时间（ms） */
export const REPLY_TIMEOUT = 120_000;
/** 文件上传超时时间（ms） */
export const UPLOAD_TIMEOUT = 120_000;
/** 媒体文件最大字节数（100MB） */
export const MEDIA_MAX_BYTES = 100 * 1024 * 1024;
// ============================================================
// 消息队列配置
// ============================================================
/** 消息队列最大容量 */
export const MESSAGE_QUEUE_SIZE = 1000;
/** 队列警告阈值 */
export const MESSAGE_QUEUE_WARN_THRESHOLD = 800;
/** 队列轮询间隔（ms） */
export const QUEUE_POLL_INTERVAL = 200;
// ============================================================
// 去重 & 节流配置
// ============================================================
/** 消息去重 TTL（ms） */
export const DEDUP_TTL = 10 * 60 * 1000;
/** 去重 Map 最大容量 */
export const DEDUP_MAX_SIZE = 5000;
/** History 请求防抖间隔（ms） */
export const HISTORY_THROTTLE_MS = 200;
/** 节流 Map 最大容量 */
export const HISTORY_THROTTLE_MAX_SIZE = 1000;
// ============================================================
// 其他配置
// ============================================================
/** Health-monitor 心跳间隔（ms），需小于框架的 stale-socket 阈值（30 分钟） */
export const HEALTH_HEARTBEAT_INTERVAL = 20 * 60_000;
/** 每个 account 最大缓冲消息数 */
export const MAX_PENDING_MESSAGES = 200;
/** 历史消息默认请求条数 */
export const DEFAULT_HISTORY_LIMIT = 100;
/** 文本分块最大长度 */
export const TEXT_CHUNK_LIMIT = 4096;
// ============================================================
// 可靠发送（ACK）配置
// ============================================================
/** ACK 等待超时（ms） */
export const EMIT_ACK_TIMEOUT = 5_000;
/** 最大重试次数 */
export const EMIT_MAX_RETRIES = 3;
/** 重试基础延迟（ms），指数退避: delay = base * 2^retryCount + jitter */
export const EMIT_RETRY_BASE_DELAY = 2_000;
/** 重试最大延迟（ms） */
export const EMIT_RETRY_MAX_DELAY = 15_000;
/** 最大待确认消息数，超出时丢弃最早的 */
export const EMIT_PENDING_MAX = 500;
/** 获取 channel 配置段 */
function getChannelSection(cfg) {
    return (cfg.channels?.[CHANNEL_KEY] ?? {});
}
/** 列出所有账户 ID */
export function listAccountIds(cfg) {
    const section = getChannelSection(cfg);
    if (!section)
        return [];
    const ids = [];
    // 默认账户：顶层有 apiKeys 即视为存在
    const keys = section.apiKeys;
    if (Array.isArray(keys) && keys.length > 0) {
        ids.push(DEFAULT_ACCOUNT_ID);
    }
    // 命名账户
    const accounts = section.accounts;
    if (accounts && typeof accounts === "object") {
        ids.push(...Object.keys(accounts));
    }
    return ids;
}
/** 解析单个账户 */
export function resolveAccount(cfg, accountId) {
    const section = getChannelSection(cfg);
    const id = accountId?.trim() || DEFAULT_ACCOUNT_ID;
    // 获取原始配置
    let raw;
    if (id === DEFAULT_ACCOUNT_ID) {
        raw = section;
    }
    else {
        const accounts = section.accounts;
        raw = accounts?.[id] ?? {};
    }
    // 解析 apiKeys（配置中只有 apiKeys，不会有 apiKey）
    const allApiKeys = Array.isArray(raw.apiKeys) ? raw.apiKeys.filter(Boolean) : [];
    // 主 key = apiKeys[0]，环境变量作为兜底
    const apiKey = allApiKeys[0] || process.env[ENV_API_KEY] || "";
    const apiBaseUrl = raw.apiBaseUrl || process.env[ENV_API_BASE_URL] || "";
    // 如果环境变量提供了 key 且 allApiKeys 为空，补入
    if (!allApiKeys.length && apiKey) {
        allApiKeys.push(apiKey);
    }
    let secretSource = "none";
    if (allApiKeys.length > 0) {
        secretSource = "config";
    }
    else if (process.env[ENV_API_KEY]) {
        secretSource = "env";
    }
    return {
        accountId: id,
        apiKey,
        allApiKeys,
        apiBaseUrl,
        enabled: raw.enabled ?? true,
        name: raw.name,
        dmPolicy: raw.dmPolicy ?? "open",
        allowFrom: raw.allowFrom ?? ["*"],
        systemPrompt: raw.systemPrompt,
        secretSource,
    };
}
/** 获取默认账户 ID */
export function defaultAccountId(_cfg) {
    return DEFAULT_ACCOUNT_ID;
}
/** 应用账户配置（setup 命令使用） */
export function applyAccountConfig(cfg, accountId, updates) {
    const nextCfg = { ...cfg };
    const nextChannels = { ...nextCfg.channels };
    const section = { ...(nextChannels[CHANNEL_KEY] ?? {}) };
    if (accountId === DEFAULT_ACCOUNT_ID) {
        Object.assign(section, updates);
    }
    else {
        const accounts = { ...(section.accounts ?? {}) };
        accounts[accountId] = { ...(accounts[accountId] ?? {}), ...updates };
        section.accounts = accounts;
    }
    nextChannels[CHANNEL_KEY] = section;
    nextCfg.channels = nextChannels;
    return nextCfg;
}
//# sourceMappingURL=config.js.map