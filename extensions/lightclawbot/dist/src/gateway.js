/**
 * LightClaw — Socket.IO Gateway
 *
 * 连接编排层：
 * 1. 管理 Socket.IO 连接生命周期（连接/断开/重连/防重入）
 * 2. 维护消息队列，串行处理入站消息
 * 3. 提供 socket emit 抽象供子模块使用
 *
 * 消息处理逻辑 → inbound.ts
 * 事件监听绑定 → socket-handlers.ts
 * 去重/节流/ID → dedup.ts
 * 媒体文件处理 → media.ts
 */
import { io } from "socket.io-client";
import { CHANNEL_KEY, WS_URL, API_BASE_URL, SOCKET_PATH, SOCKET_RECONNECTION_DELAY, SOCKET_RECONNECTION_DELAY_MAX, SOCKET_RECONNECTION_ATTEMPTS, API_PATH_USER_CURRENT, EVENT_MESSAGE_PRIVATE, MESSAGE_QUEUE_SIZE, MESSAGE_QUEUE_WARN_THRESHOLD, QUEUE_POLL_INTERVAL, HEALTH_HEARTBEAT_INTERVAL, buildAuthHeaders, buildMultiAuthHeaders, setApiKeyMap, } from "./config.js";
import { generateMsgId } from "./dedup.js";
import { createInboundHandler } from "./inbound.js";
import { bindSocketHandlers, registerSocket, unregisterSocket, flushPendingMessages } from "./socket/index.js";
import { ReliableEmitter } from "./socket/reliable-emitter.js";
import { formatCosUrls } from "./format-urls.js";
// ============================================================
// Gateway 实例追踪（防止同一 accountId 创建多个连接）
// ============================================================
/** accountId → cleanup function */
const activeGateways = new Map();
/**
 * 对每个 apiKey 调 /user/current，一次性获取 botClientId 和 uin→apiKey 映射。
 *
 * 所有 key 共享同一个 botId（来自 data.client.extra），
 * 但每个 key 对应不同的 uin（= data.id）。
 *
 * 映射表大小 = apiKeys 数量（静态、固定），不会随消息增多而增长。
 */
async function resolveApiKeyIdentities(allApiKeys, log) {
    const url = `${API_BASE_URL}${API_PATH_USER_CURRENT}`;
    const apiKeyMap = new Map();
    let botClientId = "";
    // 并发请求所有 key
    const results = await Promise.allSettled(allApiKeys.map(async (key) => {
        const resp = await fetch(url, {
            method: "GET",
            headers: buildAuthHeaders(key),
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => "");
            throw new Error(`HTTP ${resp.status} ${resp.statusText}${body ? ` — ${body}` : ""}`);
        }
        const result = (await resp.json());
        if (result.code !== 0) {
            throw new Error(`code=${result.code}, message=${result.message ?? "unknown"}`);
        }
        return { key, result };
    }));
    // 按原始顺序处理结果
    for (let i = 0; i < results.length; i++) {
        const key = allApiKeys[i];
        const settled = results[i];
        if (settled.status === "rejected") {
            log?.warn(`[${CHANNEL_KEY}] Failed to resolve uin for apiKey ***${key.slice(-4)}: ${settled.reason}`);
            continue;
        }
        const { result } = settled.value;
        // 提取 uin
        const uin = result.data?.id;
        if (!uin) {
            log?.warn(`[${CHANNEL_KEY}] Missing data.id for apiKey ***${key.slice(-4)}`);
            continue;
        }
        // 提取 botId（只需从第一个成功的 key 中获取一次）
        if (!botClientId) {
            const extra = result.data?.client?.extra;
            if (!extra) {
                log?.warn(`[${CHANNEL_KEY}] Missing data.client.extra for apiKey ***${key.slice(-4)}`);
                continue;
            }
            let parsed;
            try {
                parsed = JSON.parse(extra);
            }
            catch {
                log?.warn(`[${CHANNEL_KEY}] data.client.extra is not valid JSON for apiKey ***${key.slice(-4)}: ${extra}`);
                continue;
            }
            if (!parsed.botId) {
                log?.warn(`[${CHANNEL_KEY}] Missing botId in data.client.extra for apiKey ***${key.slice(-4)}: ${extra}`);
                continue;
            }
            botClientId = parsed.botId;
        }
        // uin 和 botClientId 都成功获取后，才加入映射
        apiKeyMap.set(uin, key);
        log?.info(`[${CHANNEL_KEY}] Mapped uin=${uin} → apiKey=***${key.slice(-4)}`);
    }
    if (!botClientId) {
        throw new Error(`[${CHANNEL_KEY}] Failed to resolve botClientId from any apiKey`);
    }
    return { botClientId, apiKeyMap };
}
// ============================================================
// 核心：启动 Gateway
// ============================================================
export async function startGateway(ctx) {
    const { account, abortSignal, onReady, onDisconnect, onEvent, log } = ctx;
    if (!account.allApiKeys.length) {
        throw new Error(`[${CHANNEL_KEY}] Missing apiKeys in config`);
    }
    // 防重入：如果同一 accountId 已有活跃 gateway，先销毁
    const existingCleanup = activeGateways.get(account.accountId);
    if (existingCleanup) {
        log?.warn(`[${CHANNEL_KEY}] Destroying existing gateway for account ${account.accountId} before creating new one`);
        existingCleanup();
    }
    // 通过 HTTP 接口获取 Bot 身份 & uin→apiKey 映射（一次性完成）
    const { allApiKeys } = account;
    log?.info(`[${CHANNEL_KEY}] Resolving identities for ${allApiKeys.length} apiKey(s)...`);
    const { botClientId, apiKeyMap } = await resolveApiKeyIdentities(allApiKeys, log);
    log?.info(`[${CHANNEL_KEY}] Bot clientId: ${botClientId}, apiKey map: ${apiKeyMap.size} entries`);
    setApiKeyMap(apiKeyMap, account.apiKey);
    let isAborted = false;
    let currentSocket = null;
    let healthHeartbeatTimer = null;
    // ---- 可靠发送器（所有出站 emit 都通过此实例） ----
    const reliableEmitter = new ReliableEmitter(() => currentSocket, log);
    // ---- Socket.IO 发送抽象 ----
    const emit = (data) => {
        // 统一拦截：所有出站消息的 content 都过一遍 formatCosUrls
        const outgoing = data.content
            ? { ...data, content: formatCosUrls(data.content) }
            : data;
        log?.info(`[${CHANNEL_KEY}] emit: ${JSON.stringify(outgoing)}`);
        // 所有消息都走可靠发送（入队即视为"发送成功"）
        reliableEmitter.emitWithAck(EVENT_MESSAGE_PRIVATE, outgoing, outgoing.msgId)
            .then(ok => {
            if (!ok) {
                log?.error(`[${CHANNEL_KEY}] Message delivery failed after retries: msgId=${outgoing.msgId}`);
            }
        });
        return true;
    };
    const sendReply = (targetId, text, replyToMsgId) => {
        log?.info(`[${CHANNEL_KEY}] sendReply: ${text} to ${targetId} (replyTo: ${replyToMsgId || "none"})`);
        return emit({
            msgId: generateMsgId(),
            from: botClientId,
            to: targetId,
            content: text,
            timestamp: Date.now(),
            replyToMsgId,
        });
    };
    const sendFiles = (targetId, text, files, replyToMsgId) => {
        return emit({
            msgId: generateMsgId(),
            from: botClientId,
            to: targetId,
            content: text,
            timestamp: Date.now(),
            files,
            replyToMsgId,
        });
    };
    const emitter = { emit, sendReply, sendFiles, botClientId };
    // ---- 入站消息处理器 ----
    const handleInboundMessage = createInboundHandler(account, emitter, log);
    // ---- 消息队列 ----
    const messageQueue = [];
    let messageProcessorRunning = false;
    let queueNotify = null;
    const enqueueMessage = (msg) => {
        if (messageQueue.length >= MESSAGE_QUEUE_SIZE) {
            const dropped = messageQueue.shift();
            log?.error(`[${CHANNEL_KEY}] Queue full, dropped message from ${dropped?.senderId}`);
        }
        if (messageQueue.length >= MESSAGE_QUEUE_WARN_THRESHOLD) {
            log?.warn(`[${CHANNEL_KEY}] Queue size: ${messageQueue.length}/${MESSAGE_QUEUE_SIZE}`);
        }
        messageQueue.push(msg);
        // 唤醒处理器
        queueNotify?.();
    };
    /** 等待队列中有新消息，或超时后返回 */
    const waitForMessage = () => {
        if (messageQueue.length > 0)
            return Promise.resolve();
        return new Promise((resolve) => {
            const timer = setTimeout(() => { queueNotify = null; resolve(); }, QUEUE_POLL_INTERVAL);
            queueNotify = () => { clearTimeout(timer); queueNotify = null; resolve(); };
        });
    };
    const startMessageProcessor = () => {
        if (messageProcessorRunning)
            return;
        messageProcessorRunning = true;
        const loop = async () => {
            while (!isAborted) {
                await waitForMessage();
                while (messageQueue.length > 0 && !isAborted) {
                    const msg = messageQueue.shift();
                    try {
                        await handleInboundMessage(msg);
                    }
                    catch (err) {
                        log?.error(`[${CHANNEL_KEY}] Message handler error: ${err}`);
                    }
                }
            }
            messageProcessorRunning = false;
        };
        loop().catch((err) => {
            log?.error(`[${CHANNEL_KEY}] Message processor crashed: ${err}`);
            messageProcessorRunning = false;
        });
    };
    // ---- 生命周期 ----
    const cleanup = () => {
        isAborted = true;
        reliableEmitter.destroy();
        if (healthHeartbeatTimer) {
            clearInterval(healthHeartbeatTimer);
            healthHeartbeatTimer = null;
        }
        unregisterSocket(account.accountId);
        activeGateways.delete(account.accountId);
        if (currentSocket) {
            currentSocket.removeAllListeners();
            currentSocket.disconnect();
            currentSocket = null;
        }
        log?.info(`[${CHANNEL_KEY}] Gateway cleaned up`);
    };
    activeGateways.set(account.accountId, cleanup);
    // ---- Socket.IO 连接 ----
    const validApiKeys = [...apiKeyMap.values()];
    log?.info(`[${CHANNEL_KEY}] Connecting to ${WS_URL}`);
    const socket = io(WS_URL, {
        auth: buildMultiAuthHeaders(validApiKeys),
        path: SOCKET_PATH,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: SOCKET_RECONNECTION_ATTEMPTS,
        reconnectionDelay: SOCKET_RECONNECTION_DELAY,
        reconnectionDelayMax: SOCKET_RECONNECTION_DELAY_MAX,
        transports: ['websocket']
    });
    currentSocket = socket;
    socket.on("connect", () => {
        log?.info(`[${CHANNEL_KEY}] Connected (id=${socket.id}, botClientId=${botClientId})`);
        registerSocket(account.accountId, socket, botClientId, reliableEmitter);
        reliableEmitter.resume();
        startMessageProcessor();
        // 重连后 flush 断线期间缓冲的 outbound 消息
        const { sent, failed } = flushPendingMessages(account.accountId, log);
        if (sent > 0 || failed > 0) {
            log?.info(`[${CHANNEL_KEY}] Flushed buffered outbound messages: sent=${sent}, failed=${failed}`);
        }
        // 启动 health-monitor 心跳：定期刷新 lastEventAt，防止空闲期被误判 stale-socket
        if (healthHeartbeatTimer)
            clearInterval(healthHeartbeatTimer);
        healthHeartbeatTimer = setInterval(() => {
            if (currentSocket?.connected) {
                onEvent?.();
                log?.debug?.(`[${CHANNEL_KEY}] Health heartbeat sent`);
            }
        }, HEALTH_HEARTBEAT_INTERVAL);
        onReady?.();
    });
    // 绑定业务事件处理器
    bindSocketHandlers(socket, {
        account,
        botClientId,
        log,
        enqueueMessage,
        onEvent,
        reliableEmitter,
    });
    socket.on("connect_error", (err) => {
        log?.error(`[${CHANNEL_KEY}] connect_error: ${err.message}`);
    });
    socket.on("disconnect", (reason) => {
        log?.info(`[${CHANNEL_KEY}] Disconnected: ${reason}`);
        reliableEmitter.pause();
        // 断线时停止心跳，避免在未连接状态下假装活跃
        if (healthHeartbeatTimer) {
            clearInterval(healthHeartbeatTimer);
            healthHeartbeatTimer = null;
        }
        // 注意：断线时不调用 unregisterSocket，保留 entry 以便 outbound 消息可以缓冲。
        // 仅在 cleanup（gateway 彻底销毁）时才 unregisterSocket。
        onDisconnect?.();
        if (reason === "io server disconnect") {
            // 服务端主动断开，需要手动重连
            log?.warn(`[${CHANNEL_KEY}] Server forced disconnect, attempting manual reconnect...`);
            socket.connect();
        }
    });
    // ---- 保持 Promise 挂起直到 abort ----
    // 框架认为 startAccount 返回的 Promise resolve = gateway 已退出，会触发 auto-restart。
    // 因此必须让 Promise 一直挂起，直到 abortSignal 触发才 resolve。
    return new Promise((resolve) => {
        abortSignal.addEventListener("abort", () => {
            cleanup();
            log?.info(`[${CHANNEL_KEY}] Gateway aborted`);
            resolve();
        });
    });
}
//# sourceMappingURL=gateway.js.map