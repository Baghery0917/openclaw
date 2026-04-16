import type { YuanbaoWsClient } from '../yuanbao-server/ws/index.js';
import { ResolvedYuanbaoAccount } from '../types.js';
import { OpenClawConfig } from 'openclaw/plugin-sdk';
export interface ActionContext {
    wsClient: YuanbaoWsClient;
    toAccount: string;
    account: ResolvedYuanbaoAccount;
    config: OpenClawConfig;
}
export type ActionResult = {
    ok: true;
    data?: unknown;
} | {
    ok: false;
    error: string;
};
export declare function handleYuanbaoAction(action: string, params: Record<string, unknown>, context: ActionContext): Promise<ActionResult>;
