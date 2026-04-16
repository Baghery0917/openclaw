/**
 * LightClaw — 可靠发送器
 *
 * 所有出站 socket.emit 都通过此模块，利用 Socket.IO 原生 ACK + timeout 机制：
 *   socket.timeout(ms).emit(event, data, (err, ...args) => { ... })
 * 超时由 Socket.IO 原生处理，回调第一个参数为 Error（超时）或 null（成功）。
 *
 * 未收到 ACK 则指数退避重试，断线期间暂停重试、重连后立即重发。
 */
import { EMIT_ACK_TIMEOUT, EMIT_MAX_RETRIES, EMIT_RETRY_BASE_DELAY, EMIT_RETRY_MAX_DELAY, EMIT_PENDING_MAX, } from "../config.js";
// ============================================================
// ReliableEmitter
// ============================================================
export class ReliableEmitter {
    getSocket;
    log;
    pending = new Map();
    paused = false;
    idCounter = 0;
    // 统计
    stats = {
        totalEmitted: 0,
        totalConfirmed: 0,
        totalRetries: 0,
        totalFailed: 0,
    };
    constructor(getSocket, log) {
        this.getSocket = getSocket;
        this.log = log;
    }
    // ----------------------------------------------------------
    // 公开 API
    // ----------------------------------------------------------
    /**
     * 可靠发送 — 带 ACK 确认 + 自动重试。
     *
     * 每次调用都是独立的发送请求，不会因相同 msgId 被合并。
     * msgId 仅用于日志追踪，内部使用自增 emitId 作为 pending key。
     *
     * @param event  Socket.IO 事件名
     * @param data   消息体
     * @param msgId  业务层消息 ID（仅用于日志追踪，可选）
     * @returns true = server 已确认, false = 重试耗尽未确认
     */
    emitWithAck(event, data, msgId) {
        // 每次调用生成唯一的内部 ID，确保同一 msgId 的多次 emit 不会互相覆盖
        const emitId = this.generateEmitId();
        this.stats.totalEmitted++;
        // 队列满时淘汰最早的
        this.evictIfNeeded();
        // 为消息体注入 idempotencyKey：
        // 使用 emitId 作为值，确保同一次 emit 的所有重试都携带相同的 key，
        // 前端据此去重，避免因 ACK 丢失重发导致用户收到重复消息。
        const enrichedData = { ...data, idempotencyKey: emitId };
        return new Promise((resolve) => {
            const entry = {
                id: emitId,
                msgId,
                event,
                data: enrichedData,
                retryCount: 0,
                createdAt: Date.now(),
                retryTimer: null,
                resolve,
            };
            this.pending.set(emitId, entry);
            if (this.paused) {
                // 断线中，先挂着，resume 时统一重发
                this.log?.info(`[ReliableEmitter] Queued while paused: emitId=${emitId}, msgId=${msgId}`);
                return;
            }
            this.doEmit(entry);
        });
    }
    /**
     * 断线时调用 — 暂停所有重试计时器
     */
    pause() {
        if (this.paused)
            return;
        this.paused = true;
        for (const entry of this.pending.values()) {
            if (entry.retryTimer) {
                clearTimeout(entry.retryTimer);
                entry.retryTimer = null;
            }
        }
        this.log?.info(`[ReliableEmitter] Paused, ${this.pending.size} message(s) pending`);
    }
    /**
     * 重连时调用 — 立即重发所有待确认消息
     */
    resume() {
        if (!this.paused)
            return;
        this.paused = false;
        this.log?.info(`[ReliableEmitter] Resumed, re-emitting ${this.pending.size} pending message(s)`);
        for (const entry of this.pending.values()) {
            this.doEmit(entry);
        }
    }
    /**
     * 销毁 — 清除所有定时器，resolve 所有 pending 为 false
     */
    destroy() {
        for (const entry of this.pending.values()) {
            if (entry.retryTimer)
                clearTimeout(entry.retryTimer);
            entry.resolve(false);
        }
        this.pending.clear();
        this.log?.info(`[ReliableEmitter] Destroyed`);
    }
    /** 当前待确认消息数 */
    get pendingCount() {
        return this.pending.size;
    }
    /** 获取统计信息 */
    getStats() {
        return { ...this.stats, currentPending: this.pending.size };
    }
    // ----------------------------------------------------------
    // 内部方法
    // ----------------------------------------------------------
    /**
     * 通过 socket.timeout(ms).emit(event, data, callback) 发送消息。
     *
     * - 超时由 Socket.IO 原生 .timeout() 处理，无需手动 setTimeout
     * - 回调签名为 (err: Error | null, ...args)，err 非空说明超时或出错
     * - socket.emit 是异步的，不会抛同步异常，无需 try-catch
     */
    doEmit(entry) {
        const socket = this.getSocket();
        if (!socket?.connected) {
            // socket 不可用，等 resume 时重发（不计重试次数）
            return;
        }
        socket.timeout(EMIT_ACK_TIMEOUT).emit(entry.event, entry.data, (err) => {
            // 已被 destroy 或 confirm
            if (!this.pending.has(entry.id))
                return;
            if (err) {
                // 超时或服务端回传了错误
                this.log?.warn(`[ReliableEmitter] ACK error: emitId=${entry.id}, msgId=${entry.msgId}, err=${err.message}, retryCount=${entry.retryCount}`);
                this.scheduleRetry(entry);
            }
            else {
                this.log?.info(`[ReliableEmitter] ACK success: emitId=${entry.id}, msgId=${entry.msgId}, retryCount=${entry.retryCount}`);
                // 服务端已确认
                this.confirm(entry.id);
            }
        });
    }
    confirm(id) {
        const entry = this.pending.get(id);
        if (!entry)
            return; // 已被 confirm 或 destroy
        if (entry.retryTimer) {
            clearTimeout(entry.retryTimer);
            entry.retryTimer = null;
        }
        this.pending.delete(id);
        this.stats.totalConfirmed++;
        entry.resolve(true);
    }
    scheduleRetry(entry) {
        // 断线中不重试
        if (this.paused)
            return;
        if (entry.retryCount >= EMIT_MAX_RETRIES) {
            // 重试耗尽
            this.pending.delete(entry.id);
            this.stats.totalFailed++;
            this.log?.error(`[ReliableEmitter] Gave up after ${entry.retryCount} retries: emitId=${entry.id}, msgId=${entry.msgId}, ` +
                `elapsed=${Date.now() - entry.createdAt}ms`);
            entry.resolve(false);
            return;
        }
        entry.retryCount++;
        this.stats.totalRetries++;
        const delay = this.getRetryDelay(entry.retryCount);
        this.log?.info(`[ReliableEmitter] Retry #${entry.retryCount} in ${delay}ms: emitId=${entry.id}, msgId=${entry.msgId}`);
        entry.retryTimer = setTimeout(() => {
            entry.retryTimer = null;
            if (this.paused)
                return; // 重试期间断线了
            this.doEmit(entry);
        }, delay);
    }
    /**
     * 指数退避 + 随机抖动
     * delay = min(base * 2^(retryCount-1) + jitter, maxDelay)
     */
    getRetryDelay(retryCount) {
        const base = EMIT_RETRY_BASE_DELAY * Math.pow(2, retryCount - 1);
        const jitter = Math.random() * 1000;
        return Math.min(base + jitter, EMIT_RETRY_MAX_DELAY);
    }
    /** 队列满时淘汰最早的 pending 消息 */
    evictIfNeeded() {
        while (this.pending.size >= EMIT_PENDING_MAX) {
            const oldest = this.pending.values().next().value;
            if (!oldest)
                break;
            if (oldest.retryTimer)
                clearTimeout(oldest.retryTimer);
            this.pending.delete(oldest.id);
            this.stats.totalFailed++;
            this.log?.warn(`[ReliableEmitter] Evicted oldest pending: emitId=${oldest.id}, msgId=${oldest.msgId}`);
            oldest.resolve(false);
        }
    }
    generateEmitId() {
        return `_re_${Date.now().toString(36)}_${(this.idCounter++).toString(36)}`;
    }
}
//# sourceMappingURL=reliable-emitter.js.map