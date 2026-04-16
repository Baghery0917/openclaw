import type { ResolvedYuanbaoAccount } from '../types.js';
import type { MessageHandlerContext } from '../message-handler/context.js';
import type { WsHeartbeatValue } from '../yuanbao-server/ws/index.js';
export interface ReplyHeartbeatMeta {
    ctx: MessageHandlerContext;
    account: ResolvedYuanbaoAccount;
    toAccount: string;
    groupCode?: string;
}
export declare function emitReplyHeartbeat(params: ReplyHeartbeatMeta & {
    heartbeat: WsHeartbeatValue;
    sendTime: number;
}): Promise<void>;
export interface ReplyHeartbeatController {
    emit(heartbeat: WsHeartbeatValue): void;
    onReplySent(): void;
    stop(): void;
}
export declare function createReplyHeartbeatController(params: {
    meta: ReplyHeartbeatMeta;
    runningIntervalMs?: number;
}): ReplyHeartbeatController;
