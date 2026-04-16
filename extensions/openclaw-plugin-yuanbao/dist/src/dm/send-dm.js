import { parseTarget, looksLikeYuanbaoId } from './targets.js';
import { resolveUsername } from './directory.js';
import { classifyError } from './error-handler.js';
import { sendYuanbaoMessage } from '../message-handler/outbound.js';
import { getActiveWsClient } from '../yuanbao-server/ws/index.js';
const YUANBAO_MAX_TEXT_LENGTH = 10000;
export async function sendDM(to, text, opts) {
    const { account, groupCode = '' } = opts;
    if (text.length > YUANBAO_MAX_TEXT_LENGTH) {
        return {
            ok: false,
            error: {
                kind: 'text-too-long',
                detail: `Message length ${text.length} exceeds limit ${YUANBAO_MAX_TEXT_LENGTH}`,
                maxLength: YUANBAO_MAX_TEXT_LENGTH,
            },
        };
    }
    if (!text.trim()) {
        return {
            ok: false,
            error: { kind: 'invalid-target', detail: 'Message text cannot be empty' },
        };
    }
    const target = parseTarget(to);
    if (!target) {
        return {
            ok: false,
            error: {
                kind: 'invalid-target',
                detail: `Cannot parse target: "${to}". Use "user:<id>" or "@username" format.`,
            },
        };
    }
    if (target.kind !== 'user') {
        return {
            ok: false,
            error: {
                kind: 'invalid-target',
                detail: `Expected user target for DM, got "${target.kind}"`,
            },
        };
    }
    let userId = target.id;
    if (!looksLikeYuanbaoId(userId)) {
        const resolved = resolveUsername(userId, account.accountId, groupCode);
        if (!resolved) {
            return {
                ok: false,
                error: {
                    kind: 'user-not-found',
                    detail: `Cannot resolve user: ${userId}`,
                },
            };
        }
        userId = resolved.userId;
    }
    const wsClient = opts.ctx?.wsClient ?? getActiveWsClient(account.accountId);
    if (!wsClient) {
        return {
            ok: false,
            error: {
                kind: 'ws-unavailable',
                detail: `WebSocket client not connected for account ${account.accountId}`,
            },
        };
    }
    try {
        const fromAccount = account.botId || undefined;
        const minCtx = opts.ctx ?? {
            groupCode,
            account,
            config: {},
            core: {},
            log: { info: () => { }, warn: () => { }, error: () => { }, verbose: () => { } },
            wsClient,
        };
        const result = await sendYuanbaoMessage({
            account,
            toAccount: userId,
            text,
            fromAccount,
            ctx: minCtx,
        });
        if (!result.ok) {
            return {
                ok: false,
                error: { kind: 'unknown', detail: result.error ?? 'Send failed' },
            };
        }
        return { ok: true, messageId: result.messageId };
    }
    catch (err) {
        return { ok: false, error: classifyError(err) };
    }
}
