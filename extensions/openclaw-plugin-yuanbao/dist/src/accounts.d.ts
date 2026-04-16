import type { OpenClawConfig } from 'openclaw/plugin-sdk';
import type { ResolvedYuanbaoAccount } from './types.js';
export declare function listYuanbaoAccountIds(cfg: OpenClawConfig): string[];
export declare function resolveDefaultYuanbaoAccountId(cfg: OpenClawConfig): string;
export declare function resolveYuanbaoAccount(params: {
    cfg: OpenClawConfig;
    accountId?: string | null;
}): ResolvedYuanbaoAccount;
export declare function listEnabledYuanbaoAccounts(cfg: OpenClawConfig): ResolvedYuanbaoAccount[];
