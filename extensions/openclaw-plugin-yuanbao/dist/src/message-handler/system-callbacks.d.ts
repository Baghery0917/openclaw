import type { YuanbaoInboundMessage } from '../types.js';
import type { MessageHandlerContext } from './context.js';
export type SystemCallbackParams = {
    ctx: MessageHandlerContext;
    msg: YuanbaoInboundMessage;
    chatType: 'c2c' | 'group';
};
export type SystemCallbackHandler = (params: SystemCallbackParams) => void;
export declare function registerSystemCallback(command: string, handler: SystemCallbackHandler): void;
export declare function dispatchSystemCallback(params: SystemCallbackParams): boolean;
