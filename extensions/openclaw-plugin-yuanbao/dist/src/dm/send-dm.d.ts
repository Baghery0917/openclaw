import type { DMError } from './error-handler.js';
import type { ResolvedYuanbaoAccount } from '../types.js';
import type { MessageHandlerContext } from '../message-handler/context.js';
export interface SendDMOptions {
    account: ResolvedYuanbaoAccount;
    groupCode?: string;
    ctx?: MessageHandlerContext;
}
export interface SendDMResult {
    ok: boolean;
    messageId?: string;
    error?: DMError;
}
export declare function sendDM(to: string, text: string, opts: SendDMOptions): Promise<SendDMResult>;
