/**
 * LightClaw — Socket 注册表
 *
 * 让 gateway 启动时注册 socket 实例，
 * outbound 在需要发送消息时可以通过 WS 连接直接发送，
 * 无需走 REST API。
 *
 * 断线缓冲：
 *   当 socket 暂时断开（Socket.IO 自动重连中）时，outbound 消息
 *   会被缓冲在 pendingMessages 队列中，重连后自动 flush 发送。
 *   仅在 gateway 彻底销毁（cleanup）时才删除 entry。
 */
import { MAX_PENDING_MESSAGES, EVENT_MESSAGE_PRIVATE } from "../config.js";
/** accountId → SocketEntry */
const registry = new Map();
// ============================================================
// 注册 / 注销
// ============================================================
/** 注册 socket（gateway 首次连接时调用） */
export function registerSocket(accountId, socket, botClientId, reliableEmitter) {
    const existing = registry.get(accountId);
    if (existing) {
        // 重连场景：更新 socket 引用，保留 pending 队列
        existing.socket = socket;
        existing.botClientId = botClientId;
        existing.reliableEmitter = reliableEmitter;
    }
    else {
        registry.set(accountId, { socket, botClientId, pendingMessages: [], reliableEmitter });
    }
}
/**
 * 注销 socket（gateway 彻底销毁时调用）。
 * 注意：普通断线重连不应调用此函数，只在 cleanup 时调用。
 */
export function unregisterSocket(accountId) {
    registry.delete(accountId);
}
// ============================================================
// 查询
// ============================================================
/** 获取可用的 socket（仅在 connected 时返回） */
export function getSocket(accountId) {
    const entry = registry.get(accountId);
    if (entry && entry.socket.connected)
        return entry;
    return undefined;
}
/** 检查 account 是否有注册的 entry（不管是否 connected） */
export function hasEntry(accountId) {
    return registry.has(accountId);
}
/** 获取 botClientId（不管 socket 是否 connected） */
export function getBotClientId(accountId) {
    return registry.get(accountId)?.botClientId;
}
/** 获取可靠发送器 */
export function getReliableEmitter(accountId) {
    return registry.get(accountId)?.reliableEmitter;
}
// ============================================================
// 断线缓冲
// ============================================================
/**
 * 缓冲一条消息（socket 断开期间由 outbound 调用）。
 * 返回 true 表示成功缓冲，false 表示该 account 没有注册的 entry。
 */
export function bufferMessage(accountId, message) {
    const entry = registry.get(accountId);
    if (!entry)
        return false;
    if (entry.pendingMessages.length >= MAX_PENDING_MESSAGES) {
        // 队列满了，丢弃最早的消息
        entry.pendingMessages.shift();
    }
    entry.pendingMessages.push(message);
    return true;
}
/**
 * flush 所有缓冲消息（重连成功后由 gateway 调用）。
 * 如果有 ReliableEmitter，走可靠发送；否则 fallback 直接 emit。
 * 返回发送成功 / 失败的计数。
 */
export function flushPendingMessages(accountId, log) {
    const entry = registry.get(accountId);
    if (!entry)
        return { sent: 0, failed: 0 };
    const pending = entry.pendingMessages.splice(0); // 取出全部并清空
    if (pending.length === 0)
        return { sent: 0, failed: 0 };
    let sent = 0;
    let failed = 0;
    for (const msg of pending) {
        if (!entry.socket.connected) {
            // socket 又断了，把剩余消息放回去
            entry.pendingMessages.unshift(...pending.slice(sent + failed));
            break;
        }
        if (entry.reliableEmitter) {
            // 通过可靠发送器发送
            entry.reliableEmitter.emitWithAck(EVENT_MESSAGE_PRIVATE, msg, msg.msgId);
            sent++;
        }
        else {
            // fallback: 直接 emit（不应该走到这里）
            try {
                entry.socket.emit(EVENT_MESSAGE_PRIVATE, msg);
                sent++;
            }
            catch {
                failed++;
                log?.warn(`[socket-registry] Failed to flush buffered message: msgId=${msg.msgId}`);
            }
        }
    }
    if (sent > 0 || failed > 0) {
        log?.info(`[socket-registry] Flushed pending messages: sent=${sent}, failed=${failed}`);
    }
    return { sent, failed };
}
/** 获取缓冲队列长度（调试/监控用） */
export function getPendingCount(accountId) {
    return registry.get(accountId)?.pendingMessages.length ?? 0;
}
//# sourceMappingURL=registry.js.map