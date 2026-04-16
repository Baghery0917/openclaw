/**
 * LightClaw — 可靠发送器
 *
 * 所有出站 socket.emit 都通过此模块，利用 Socket.IO 原生 ACK + timeout 机制：
 *   socket.timeout(ms).emit(event, data, (err, ...args) => { ... })
 * 超时由 Socket.IO 原生处理，回调第一个参数为 Error（超时）或 null（成功）。
 *
 * 未收到 ACK 则指数退避重试，断线期间暂停重试、重连后立即重发。
 */
import type { Socket } from "socket.io-client";
export interface EmitterStats {
    totalEmitted: number;
    totalConfirmed: number;
    totalRetries: number;
    totalFailed: number;
    currentPending: number;
}
type LogFn = {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
};
export declare class ReliableEmitter {
    private getSocket;
    private log?;
    private pending;
    private paused;
    private idCounter;
    private stats;
    constructor(getSocket: () => Socket | null, log?: LogFn | undefined);
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
    emitWithAck(event: string, data: object, msgId?: string): Promise<boolean>;
    /**
     * 断线时调用 — 暂停所有重试计时器
     */
    pause(): void;
    /**
     * 重连时调用 — 立即重发所有待确认消息
     */
    resume(): void;
    /**
     * 销毁 — 清除所有定时器，resolve 所有 pending 为 false
     */
    destroy(): void;
    /** 当前待确认消息数 */
    get pendingCount(): number;
    /** 获取统计信息 */
    getStats(): EmitterStats;
    /**
     * 通过 socket.timeout(ms).emit(event, data, callback) 发送消息。
     *
     * - 超时由 Socket.IO 原生 .timeout() 处理，无需手动 setTimeout
     * - 回调签名为 (err: Error | null, ...args)，err 非空说明超时或出错
     * - socket.emit 是异步的，不会抛同步异常，无需 try-catch
     */
    private doEmit;
    private confirm;
    private scheduleRetry;
    /**
     * 指数退避 + 随机抖动
     * delay = min(base * 2^(retryCount-1) + jitter, maxDelay)
     */
    private getRetryDelay;
    /** 队列满时淘汰最早的 pending 消息 */
    private evictIfNeeded;
    private generateEmitId;
}
export {};
//# sourceMappingURL=reliable-emitter.d.ts.map