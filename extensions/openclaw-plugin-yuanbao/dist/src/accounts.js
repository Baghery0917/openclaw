import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk/core';
import { normalizeAccountId } from 'openclaw/plugin-sdk/account-id';
import { logger } from './logger.js';
import { getCachedBotId } from './yuanbao-server/http/request.js';
const DEFAULT_API_DOMAIN = 'bot.yuanbao.tencent.com';
const DEFAULT_WS_GATEWAY_URL = 'wss://bot-wss.yuanbao.tencent.com/wss/connection';
function listConfiguredAccountIds(cfg) {
    const accounts = cfg.channels?.yuanbao?.accounts;
    if (!accounts || typeof accounts !== 'object')
        return [];
    return Object.keys(accounts).filter(Boolean);
}
export function listYuanbaoAccountIds(cfg) {
    const ids = listConfiguredAccountIds(cfg);
    if (ids.length === 0)
        return [DEFAULT_ACCOUNT_ID];
    return ids.sort((a, b) => a.localeCompare(b));
}
export function resolveDefaultYuanbaoAccountId(cfg) {
    const yuanbaoConfig = cfg.channels?.yuanbao;
    if (yuanbaoConfig?.defaultAccount?.trim())
        return yuanbaoConfig.defaultAccount.trim();
    const ids = listYuanbaoAccountIds(cfg);
    if (ids.includes(DEFAULT_ACCOUNT_ID))
        return DEFAULT_ACCOUNT_ID;
    return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
    const accounts = cfg.channels?.yuanbao?.accounts;
    if (!accounts || typeof accounts !== 'object')
        return undefined;
    return accounts[accountId];
}
function mergeYuanbaoAccountConfig(cfg, accountId) {
    const raw = (cfg.channels?.yuanbao ?? {});
    const { accounts: _accounts, defaultAccount: _defaultAccount, ...base } = raw;
    const account = resolveAccountConfig(cfg, accountId) ?? {};
    const merged = { ...base, ...account };
    return merged;
}
function resolveOverflowPolicy(raw) {
    return raw === 'stop' ? 'stop' : 'split';
}
function resolveReplyToMode(raw) {
    if (raw === 'off' || raw === 'all')
        return raw;
    return 'first';
}
function warnIncompleteConfig(appKey, appSecret) {
    const missing = [];
    if (!appKey)
        missing.push('appKey');
    if (!appSecret)
        missing.push('appSecret');
    if (missing.length > 0) {
        logger.warn(`配置不完整，缺少: ${missing.join(', ')}`);
    }
}
export function resolveYuanbaoAccount(params) {
    const accountId = normalizeAccountId(params.accountId);
    const yuanbaoConfig = params.cfg.channels?.yuanbao;
    const baseEnabled = yuanbaoConfig?.enabled !== false;
    const merged = mergeYuanbaoAccountConfig(params.cfg, accountId);
    const enabled = baseEnabled && merged.enabled !== false;
    let appKey = merged.appKey?.trim() || undefined;
    let appSecret = merged.appSecret?.trim() || undefined;
    const apiDomain = merged.apiDomain?.trim() || DEFAULT_API_DOMAIN;
    let token = merged.token?.trim() || undefined;
    const overflowPolicy = resolveOverflowPolicy(merged.overflowPolicy);
    const replyToMode = resolveReplyToMode(merged.replyToMode);
    if ((!appKey || !appSecret) && token) {
        const colonIdx = token.indexOf(':');
        if (colonIdx > 0) {
            const parsedKey = token.slice(0, colonIdx).trim();
            const parsedSecret = token.slice(colonIdx + 1).trim();
            if (parsedKey && parsedSecret) {
                if (!appKey)
                    appKey = parsedKey;
                if (!appSecret)
                    appSecret = parsedSecret;
                token = undefined;
            }
        }
    }
    const wsGatewayUrl = merged.wsUrl?.trim() || DEFAULT_WS_GATEWAY_URL;
    const wsHeartbeatInterval = undefined;
    const wsMaxReconnectAttempts = 100;
    const mediaMaxMb = merged.mediaMaxMb && merged.mediaMaxMb >= 1 ? merged.mediaMaxMb : 20;
    const historyLimit = merged.historyLimit !== undefined && merged.historyLimit >= 0
        ? merged.historyLimit
        : 100;
    const disableBlockStreaming = merged.disableBlockStreaming !== undefined ? merged.disableBlockStreaming : false;
    const requireMention = merged.requireMention !== undefined ? merged.requireMention : true;
    const fallbackReply = merged.fallbackReply?.trim();
    const markdownHintEnabled = merged.markdownHintEnabled !== false;
    const configured = Boolean(appKey && appSecret);
    if (!configured && Boolean(yuanbaoConfig)) {
        warnIncompleteConfig(appKey, appSecret);
    }
    return {
        accountId,
        name: merged.name?.trim() || undefined,
        enabled,
        configured,
        appKey,
        appSecret,
        botId: getCachedBotId(accountId) || undefined,
        apiDomain,
        ...(token ? { token } : {}),
        wsGatewayUrl,
        wsHeartbeatInterval,
        wsMaxReconnectAttempts,
        overflowPolicy,
        replyToMode,
        mediaMaxMb,
        historyLimit,
        disableBlockStreaming,
        requireMention,
        fallbackReply,
        markdownHintEnabled,
        config: merged,
    };
}
export function listEnabledYuanbaoAccounts(cfg) {
    return listYuanbaoAccountIds(cfg)
        .map(accountId => resolveYuanbaoAccount({ cfg, accountId }))
        .filter(account => account.enabled);
}
