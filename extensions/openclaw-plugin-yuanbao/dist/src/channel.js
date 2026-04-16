import { DEFAULT_ACCOUNT_ID, deleteAccountFromConfigSection, setAccountEnabledInConfigSection, } from 'openclaw/plugin-sdk/core';
import { formatPairingApproveHint } from 'openclaw/plugin-sdk/mattermost';
import { listYuanbaoAccountIds, resolveDefaultYuanbaoAccountId, resolveYuanbaoAccount } from './accounts.js';
import { yuanbaoConfigSchema } from './config-schema.js';
import { yuanbaoOnboardingAdapter } from './onboarding.js';
import { createLog, setDebugBotIds } from './logger.js';
import { yuanbaoSetupAdapter } from './setup.js';
import { startYuanbaoWsGateway, getActiveWsClient } from './yuanbao-server/ws/index.js';
import { getYuanbaoRuntime } from './runtime.js';
import { sendYuanbaoMessage, sendYuanbaoGroupMessage } from './message-handler/index.js';
import { initOutboundQueue, destroyOutboundQueue, getOutboundQueue } from './outbound-queue.js';
import { ChatType, getGroupCode, parseTarget } from './targets.js';
import { buildMessageToolHints, yuanbaoMessageActions } from './message-tool/index.js';
function toChannelResult(result) {
    return {
        channel: 'yuanbao',
        ok: result.ok,
        messageId: result.messageId ?? '',
        error: result.error ? new Error(result.error) : undefined,
    };
}
function buildMinCtx(account, wsClient) {
    return {
        account,
        config: account.config,
        core: {},
        log: { info: () => { }, warn: () => { }, error: () => { }, verbose: () => { } },
        wsClient,
        groupCode: getGroupCode(),
    };
}
async function sendTextToTarget(account, target, text, wsClient) {
    const minCtx = wsClient
        ? {
            account,
            config: {},
            core: {},
            log: { info: () => { }, warn: () => { }, error: () => { }, verbose: () => { } },
            wsClient,
        }
        : undefined;
    const { chatType, target: targetId } = parseTarget(target, account.accountId);
    if (chatType === ChatType.GROUP) {
        return sendYuanbaoGroupMessage({ account, groupCode: targetId, text, fromAccount: account.botId, ctx: minCtx });
    }
    return sendYuanbaoMessage({ account, toAccount: targetId, text, fromAccount: account.botId, ctx: minCtx });
}
const meta = {
    id: 'yuanbao',
    label: '元宝 Bot',
    selectionLabel: '元宝 Bot (yuanbao)',
    detailLabel: '元宝 Bot',
    docsPath: '/channels/yuanbao',
    docsLabel: 'yuanbao',
    blurb: 'YuanBao bot via WebSocket.',
    aliases: ['yuanbao', '元宝', '即时通信'],
    order: 85,
    quickstartAllowFrom: true,
};
function normalizeYuanbaoMessagingTarget(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return undefined;
    return trimmed.replace(/^(yuanbao):/i, '').trim() || undefined;
}
export const yuanbaoPlugin = {
    id: 'yuanbao',
    meta,
    onboarding: yuanbaoOnboardingAdapter,
    setup: yuanbaoSetupAdapter,
    actions: yuanbaoMessageActions,
    capabilities: {
        chatTypes: ['direct', 'group'],
        media: true,
        reactions: true,
        threads: false,
        polls: false,
        nativeCommands: true,
    },
    reload: { configPrefixes: ['channels.yuanbao'] },
    configSchema: yuanbaoConfigSchema,
    config: {
        listAccountIds: cfg => listYuanbaoAccountIds(cfg),
        resolveAccount: (cfg, accountId) => resolveYuanbaoAccount({ cfg: cfg, accountId }),
        defaultAccountId: cfg => resolveDefaultYuanbaoAccountId(cfg),
        setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
            cfg: cfg,
            sectionKey: 'yuanbao',
            accountId,
            enabled,
            allowTopLevel: true,
        }),
        deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
            cfg: cfg,
            sectionKey: 'yuanbao',
            clearBaseFields: [
                'name',
                'appKey',
                'appSecret',
                'token',
                'overflowPolicy',
                'replyToMode',
                'outboundQueueStrategy',
                'mediaMaxMb',
                'historyLimit',
                'disableBlockStreaming',
                'fallbackReply',
            ],
            accountId,
        }),
        isConfigured: account => account.configured,
        describeAccount: (account) => ({
            accountId: account.accountId,
            name: account.name,
            enabled: account.enabled,
            configured: account.configured,
            tokenStatus: account.configured ? 'available' : 'missing',
        }),
        resolveAllowFrom: ({ cfg, accountId }) => {
            const account = resolveYuanbaoAccount({ cfg: cfg, accountId });
            return (account.config.dm?.allowFrom ?? []).map(entry => String(entry));
        },
        formatAllowFrom: ({ allowFrom }) => allowFrom
            .map(entry => String(entry).trim())
            .filter(Boolean)
            .map(entry => entry.toLowerCase()),
    },
    security: {
        resolveDmPolicy: ({ cfg, accountId, account }) => {
            const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
            const useAccountPath = Boolean(cfg.channels?.yuanbao?.accounts?.[resolvedAccountId]);
            const basePath = useAccountPath ? `channels.yuanbao.accounts.${resolvedAccountId}.` : 'channels.yuanbao.';
            const policy = account.config.dm?.policy ?? 'open';
            const rawAllowFrom = (account.config.dm?.allowFrom ?? []).map(entry => String(entry));
            const allowFrom = policy === 'open' && !rawAllowFrom.includes('*')
                ? [...rawAllowFrom, '*']
                : rawAllowFrom;
            return {
                policy,
                allowFrom,
                policyPath: `${basePath}dm.policy`,
                allowFromPath: `${basePath}dm.allowFrom`,
                approveHint: formatPairingApproveHint('yuanbao'),
                normalizeEntry: raw => raw.trim().toLowerCase(),
            };
        },
    },
    groups: {
        resolveRequireMention: () => true,
    },
    threading: {
        resolveReplyToMode: () => 'all',
    },
    messaging: {
        normalizeTarget: normalizeYuanbaoMessagingTarget,
        targetResolver: {
            looksLikeId: raw => Boolean(raw.trim()),
            hint: '<userid> or group:<groupcode>',
        },
    },
    agentPrompt: {
        messageToolHints() {
            return buildMessageToolHints();
        },
    },
    streaming: {
        blockStreamingChunkMaxChars: 3000,
        blockStreamingCoalesceDefaults: {
            minChars: 2800,
            idleMs: 1000,
            joiner: '',
        },
    },
    outbound: {
        deliveryMode: 'direct',
        chunkerMode: 'markdown',
        textChunkLimit: 3000,
        chunker: (text, limit) => getYuanbaoRuntime()?.channel.text.chunkMarkdownText(text, limit) ?? [text],
        sendText: async (params) => {
            const { cfg, accountId, to: _to, text } = params;
            const to = _to.replace(/^yuanbao:/, '');
            const account = resolveYuanbaoAccount({ cfg, accountId: accountId ?? undefined });
            const slog = createLog('channel.outbound', undefined, { botId: account.botId });
            slog.info('sendText', { accountId, to });
            const wsClient = getActiveWsClient(account.accountId);
            if (!wsClient) {
                return { channel: 'yuanbao', ok: false, messageId: '', error: new Error(`WebSocket client not connected for account ${account.accountId}`) };
            }
            const queueManager = getOutboundQueue(account.accountId);
            if (queueManager) {
                const { chatType, target, sessionKey } = parseTarget(to, account.accountId);
                const session = queueManager.getOrCreateSession(sessionKey, {
                    chatType,
                    account,
                    target,
                    fromAccount: account.botId,
                    ctx: buildMinCtx(account, wsClient),
                });
                await session.push({ type: 'text', text });
                await session.flush();
                return { channel: 'yuanbao', ok: true, messageId: '' };
            }
            return toChannelResult(await sendTextToTarget(account, to, text, wsClient));
        },
        sendMedia: async (params) => {
            const { cfg, accountId, to: _to, mediaUrl, text, mediaLocalRoots } = params;
            const to = _to.replace(/^yuanbao:/, '');
            const account = resolveYuanbaoAccount({ cfg, accountId: accountId ?? undefined });
            const slog = createLog('channel.outbound', undefined, { botId: account.botId });
            const wsClient = getActiveWsClient(account.accountId);
            slog.info('sendMedia', { accountId, to, mediaUrl, text });
            if (!wsClient) {
                return { channel: 'yuanbao', ok: false, messageId: '', error: new Error(`WebSocket client not connected for account ${account.accountId}`) };
            }
            if (!mediaUrl) {
                return { channel: 'yuanbao', ok: true, messageId: '' };
            }
            const queueManager = getOutboundQueue(account.accountId);
            if (queueManager) {
                const { chatType, target, sessionKey } = parseTarget(to, account.accountId);
                const session = queueManager.getOrCreateSession(sessionKey, {
                    chatType,
                    account,
                    target,
                    fromAccount: account.botId,
                    ctx: buildMinCtx(account, wsClient),
                });
                if (text?.trim()) {
                    await session.push({ type: 'text', text });
                }
                await session.push({ type: 'media', mediaUrl, mediaLocalRoots });
                await session.flush();
                return { channel: 'yuanbao', ok: true, messageId: '' };
            }
            return { channel: 'yuanbao', ok: false, messageId: '', error: new Error('No session found') };
        },
    },
    status: {
        defaultRuntime: {
            accountId: DEFAULT_ACCOUNT_ID,
            running: false,
            connected: false,
            lastConnectedAt: null,
            lastError: null,
            lastInboundAt: null,
            lastOutboundAt: null,
        },
        buildChannelSummary: ({ snapshot }) => ({
            configured: snapshot.configured ?? false,
            tokenSource: snapshot.tokenSource ?? 'none',
            running: snapshot.running ?? false,
            connected: snapshot.connected ?? false,
            lastConnectedAt: snapshot.lastConnectedAt ?? null,
            lastError: snapshot.lastError ?? null,
        }),
        buildAccountSnapshot: ({ account, runtime }) => ({
            accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
            name: account?.name,
            enabled: account?.enabled ?? false,
            configured: Boolean(account?.appKey && account?.appSecret),
            tokenSource: account?.secretSource,
            running: Boolean(runtime?.running ?? false),
            connected: Boolean(runtime?.connected ?? false),
            lastConnectedAt: runtime?.lastConnectedAt ?? null,
            lastError: runtime?.lastError ?? null,
            lastInboundAt: runtime?.lastInboundAt ?? null,
            lastOutboundAt: runtime?.lastOutboundAt ?? null,
        }),
    },
    gateway: {
        startAccount: async (ctx) => {
            const { account } = ctx;
            const yuanbaoTopConfig = ctx.cfg.channels?.yuanbao;
            if (yuanbaoTopConfig?.debugBotIds?.length) {
                setDebugBotIds(yuanbaoTopConfig.debugBotIds);
            }
            const slog = createLog('gateway', ctx.log, { botId: account.botId });
            slog.debug('启动账号', account);
            if (!account.configured) {
                slog.warn('yuanbao not configured; skipping');
                ctx.setStatus({ accountId: account.accountId, running: false, configured: false });
                return;
            }
            slog.info('使用 WebSocket 模式连接');
            ctx.setStatus({
                accountId: account.accountId,
                running: true,
                configured: true,
                lastStartAt: Date.now(),
            });
            const cfg = account.config;
            const strategy = cfg.outboundQueueStrategy === 'immediate' ? 'immediate' : 'merge-text';
            initOutboundQueue(account.accountId, {
                strategy,
                maxChars: cfg.maxChars,
                chunkText: (text, limit) => getYuanbaoRuntime().channel.text.chunkMarkdownText(text, limit),
            });
            slog.info(`[${account.accountId}] 出站队列已初始化，策略: ${strategy}，maxChars: ${cfg.maxChars ?? 3000}`);
            return startYuanbaoWsGateway({
                account,
                config: ctx.cfg,
                abortSignal: ctx.abortSignal,
                log: ctx.log,
                runtime: getYuanbaoRuntime(),
                statusSink: patch => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
            });
        },
        stopAccount: async (ctx) => {
            destroyOutboundQueue(ctx.account.accountId);
            ctx.setStatus({
                accountId: ctx.account.accountId,
                running: false,
                connected: false,
                lastStopAt: Date.now(),
            });
        },
    },
};
