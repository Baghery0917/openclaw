import type { YuanbaoInboundMessage } from '../../types.js';
import type { MessageHandlerContext } from '../context.js';
export declare function handleGroupRecall(ctx: MessageHandlerContext, msg: YuanbaoInboundMessage): void;
export declare function handleC2CRecall(ctx: MessageHandlerContext, msg: YuanbaoInboundMessage): void;
