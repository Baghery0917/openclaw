import type { YuanbaoInboundMessage } from '../types.js';
import type { MessageHandlerContext } from './context.js';
import './callbacks/recall.js';
export declare function handleInboundMessage(params: {
    ctx: MessageHandlerContext;
    msg: YuanbaoInboundMessage;
    chatType: 'c2c' | 'group';
}): Promise<void>;
