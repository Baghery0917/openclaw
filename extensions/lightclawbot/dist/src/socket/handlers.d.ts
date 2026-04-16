/**
 * LightClaw — Socket.IO 事件处理器
 *
 * 将 socket 事件监听（message:private、history:request、sessions:request）
 * 从 gateway 主逻辑中解耦。
 *
 * 所有出站 socket.emit 通过 ReliableEmitter 实现 ACK 确认 + 自动重试。
 */
import type { Socket } from "socket.io-client";
import type { GatewayContext, QueuedMessage } from "../types.js";
import type { ReliableEmitter } from "./reliable-emitter.js";
export interface SocketHandlerDeps {
    account: GatewayContext["account"];
    botClientId: string;
    log?: GatewayContext["log"];
    enqueueMessage: (msg: QueuedMessage) => void;
    /** 收到入站事件时调用，通知框架更新 lastEventAt */
    onEvent?: () => void;
    /** 可靠发送器 — 所有出站 emit 都通过此发送 */
    reliableEmitter: ReliableEmitter;
}
/**
 * 绑定所有 Socket.IO 事件监听器
 */
export declare function bindSocketHandlers(socket: Socket, deps: SocketHandlerDeps): void;
//# sourceMappingURL=handlers.d.ts.map