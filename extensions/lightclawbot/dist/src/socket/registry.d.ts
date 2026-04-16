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
import type { Socket } from "socket.io-client";
import type { PrivateMessageData } from "../types.js";
import type { ReliableEmitter } from "./reliable-emitter.js";
interface SocketEntry {
    socket: Socket;
    botClientId: string;
    /** 断线期间缓冲的待发消息 */
    pendingMessages: PrivateMessageData[];
    /** 可靠发送器（由 gateway 创建后注入） */
    reliableEmitter?: ReliableEmitter;
}
/** 注册 socket（gateway 首次连接时调用） */
export declare function registerSocket(accountId: string, socket: Socket, botClientId: string, reliableEmitter?: ReliableEmitter): void;
/**
 * 注销 socket（gateway 彻底销毁时调用）。
 * 注意：普通断线重连不应调用此函数，只在 cleanup 时调用。
 */
export declare function unregisterSocket(accountId: string): void;
/** 获取可用的 socket（仅在 connected 时返回） */
export declare function getSocket(accountId: string): Pick<SocketEntry, "socket" | "botClientId"> | undefined;
/** 检查 account 是否有注册的 entry（不管是否 connected） */
export declare function hasEntry(accountId: string): boolean;
/** 获取 botClientId（不管 socket 是否 connected） */
export declare function getBotClientId(accountId: string): string | undefined;
/** 获取可靠发送器 */
export declare function getReliableEmitter(accountId: string): ReliableEmitter | undefined;
/**
 * 缓冲一条消息（socket 断开期间由 outbound 调用）。
 * 返回 true 表示成功缓冲，false 表示该 account 没有注册的 entry。
 */
export declare function bufferMessage(accountId: string, message: PrivateMessageData): boolean;
/**
 * flush 所有缓冲消息（重连成功后由 gateway 调用）。
 * 如果有 ReliableEmitter，走可靠发送；否则 fallback 直接 emit。
 * 返回发送成功 / 失败的计数。
 */
export declare function flushPendingMessages(accountId: string, log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
}): {
    sent: number;
    failed: number;
};
/** 获取缓冲队列长度（调试/监控用） */
export declare function getPendingCount(accountId: string): number;
export {};
//# sourceMappingURL=registry.d.ts.map