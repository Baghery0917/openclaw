/**
 * LightClaw — 出站消息适配器
 *
 * 处理 OpenClaw 框架层的主动消息发送（非 deliver 回调场景）。
 * 例如：用户通过 /message 命令发消息、cron 定时任务触发等。
 *
 * 发送策略：
 *   1. 优先通过 gateway 的 WS 长连接发送（socket-registry）
 *   2. WS 不可用时 fallback 到 REST API（需配置 apiBaseUrl）
 */
import { resolveAccount, CHANNEL_KEY, DEFAULT_ACCOUNT_ID, EVENT_MESSAGE_PRIVATE } from "./config.js";
import { getAssistantRuntime } from "./runtime.js";
import { getSocket, bufferMessage, hasEntry, getBotClientId, getReliableEmitter } from "./socket/index.js";
import { formatCosUrls } from "./format-urls.js";
/** 获取日志器 */
function getLogger() {
    return getAssistantRuntime().logging.getChildLogger({ module: "outbound" });
}
/** 生成消息 ID */
let outboundMsgCounter = 0;
function generateOutboundMsgId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    const seq = (outboundMsgCounter++).toString(36);
    return `ob-${ts}-${rand}-${seq}`;
}
/**
 * 解析目标用户 ID：去掉各种前缀，提取纯 ID
 * 支持格式: user:xxx, channel:xxx, lightclawbot:dm:xxx, lightclawbot:group:xxx, dm:xxx, 纯ID
 */
function resolveTarget(to) {
    return to
        .replace(new RegExp(`^${CHANNEL_KEY}:`, "i"), "")
        .replace(/^(user|channel|dm|group):/, "");
}
/**
 * 通过 WS 发送消息。
 *
 * 策略：
 *   1. socket connected → 直接发送
 *   2. socket 断开但 entry 存在（正在重连中）→ 缓冲消息，重连后自动 flush
 *   3. entry 不存在 → 返回 null（gateway 尚未启动或已销毁）
 */
function sendViaSocket(accountId, target, text, replyToId) {
    const resolvedAccountId = accountId || DEFAULT_ACCOUNT_ID;
    const entry = getSocket(resolvedAccountId);
    const msgId = generateOutboundMsgId();
    const message = {
        msgId,
        from: entry?.botClientId ?? getBotClientId(resolvedAccountId) ?? "",
        to: target,
        content: formatCosUrls(text),
        timestamp: Date.now(),
        replyToMsgId: replyToId ?? undefined,
    };
    if (entry) {
        // Socket connected — 优先走可靠发送
        const emitter = getReliableEmitter(resolvedAccountId);
        if (emitter) {
            emitter.emitWithAck(EVENT_MESSAGE_PRIVATE, message, msgId)
                .then(ok => {
                if (!ok) {
                    getLogger().error(`[${CHANNEL_KEY}] outbound delivery failed after retries: msgId=${msgId}`);
                }
            });
            getLogger().info(`[${CHANNEL_KEY}] outbound sent via reliable WS: to=${target} msgId=${msgId}`);
            return msgId;
        }
        // fallback: 直接 emit（不应走到这里，但保留兜底）
        try {
            entry.socket.emit(EVENT_MESSAGE_PRIVATE, message);
            getLogger().info(`[${CHANNEL_KEY}] outbound sent via WS (fallback): to=${target} msgId=${msgId}`);
            return msgId;
        }
        catch (err) {
            getLogger().warn(`[${CHANNEL_KEY}] outbound WS emit failed: ${err}`);
            return null;
        }
    }
    // Socket 断开但 entry 存在（正在自动重连），缓冲消息
    if (hasEntry(resolvedAccountId)) {
        const buffered = bufferMessage(resolvedAccountId, message);
        if (buffered) {
            getLogger().info(`[${CHANNEL_KEY}] outbound buffered (WS reconnecting): to=${target} msgId=${msgId}`);
            return msgId;
        }
    }
    // Entry 不存在，gateway 未启动或已销毁
    return null;
}
/**
 * 发送文本消息
 * 由 channel.outbound.sendText 调用
 */
export async function sendText(ctx) {
    const log = getLogger();
    try {
        const account = resolveAccount(ctx.cfg, ctx.accountId);
        const target = resolveTarget(ctx.to);
        // 优先走 WS
        const wsMsgId = sendViaSocket(account.accountId, target, ctx.text, ctx.replyToId);
        if (wsMsgId) {
            return { channel: CHANNEL_KEY, messageId: wsMsgId };
        }
        // Fallback: REST API
        if (!account.apiBaseUrl) {
            throw new Error("WS not connected and apiBaseUrl not configured, cannot send outbound message");
        }
        log.info(`[${CHANNEL_KEY}] outbound fallback to REST API: to=${target}`);
        const resp = await fetch(`${account.apiBaseUrl}/send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${account.apiKey}`,
            },
            body: JSON.stringify({
                target,
                text: ctx.text,
                replyToMessageId: ctx.replyToId,
            }),
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Send failed (${resp.status}): ${errText}`);
        }
        const data = (await resp.json());
        return { channel: CHANNEL_KEY, messageId: data.messageId ?? `msg_${Date.now()}` };
    }
    catch (err) {
        log.error(`[${CHANNEL_KEY}] outbound.sendText error: ${err}`);
        throw err;
    }
}
/**
 * 发送媒体消息
 * 由 channel.outbound.sendMedia 调用
 */
export async function sendMedia(ctx) {
    const log = getLogger();
    try {
        const account = resolveAccount(ctx.cfg, ctx.accountId);
        const target = resolveTarget(ctx.to);
        // 优先走 WS（媒体消息只发文本部分，因为 WS 不方便传大文件）
        // 如果有 mediaUrl 且没有 REST API，仍用 WS 发文本
        if (!ctx.mediaUrl) {
            const wsMsgId = sendViaSocket(account.accountId, target, ctx.text, ctx.replyToId);
            if (wsMsgId) {
                return { channel: CHANNEL_KEY, messageId: wsMsgId };
            }
        }
        // Fallback: REST API
        if (!account.apiBaseUrl) {
            // 没有 REST API 也没有 mediaUrl，用 WS 发文本
            const wsMsgId = sendViaSocket(account.accountId, target, ctx.text, ctx.replyToId);
            if (wsMsgId) {
                return { channel: CHANNEL_KEY, messageId: wsMsgId };
            }
            throw new Error("WS not connected and apiBaseUrl not configured, cannot send outbound media");
        }
        log.info(`[${CHANNEL_KEY}] outbound media via REST API: to=${target}`);
        const resp = await fetch(`${account.apiBaseUrl}/send-media`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${account.apiKey}`,
            },
            body: JSON.stringify({
                target,
                text: ctx.text,
                mediaUrl: ctx.mediaUrl,
                replyToMessageId: ctx.replyToId,
            }),
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`Send media failed (${resp.status}): ${errText}`);
        }
        const data = (await resp.json());
        return { channel: CHANNEL_KEY, messageId: data.messageId ?? `msg_${Date.now()}` };
    }
    catch (err) {
        log.error(`[${CHANNEL_KEY}] outbound.sendMedia error: ${err}`);
        throw err;
    }
}
//# sourceMappingURL=outbound.js.map