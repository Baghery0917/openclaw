/**
 * LightClaw — 入站消息处理
 *
 * 接收用户消息 → 文件处理 → 路由 → AI 分发 → 回复
 */
import type { GatewayContext, QueuedMessage, PrivateMessageData, FileAttachment } from "./types.js";
/** emit / sendReply / sendFiles 等 socket 操作的抽象接口 */
export interface SocketEmitter {
    emit: (data: PrivateMessageData) => boolean;
    sendReply: (targetId: string, text: string, replyToMsgId?: string) => boolean;
    sendFiles: (targetId: string, text: string, files: FileAttachment[], replyToMsgId?: string) => boolean;
    botClientId: string;
}
/**
 * 创建入站消息处理器
 */
export declare function createInboundHandler(account: GatewayContext["account"], emitter: SocketEmitter, log?: GatewayContext["log"]): (msg: QueuedMessage) => Promise<void>;
//# sourceMappingURL=inbound.d.ts.map