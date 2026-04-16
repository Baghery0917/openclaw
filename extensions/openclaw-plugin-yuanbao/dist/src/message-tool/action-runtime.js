import { searchStickers } from '../sticker/sticker-cache.js';
import { getOutboundQueue } from '../outbound-queue.js';
import { logger } from '../logger.js';
import { getYuanbaoRuntime } from '../runtime.js';
import { getGroupCode, parseTarget } from '../targets.js';
function normalizeStickerSearchQuery(params) {
    const raw = params.query ?? params.keyword ?? params.q ?? params.text ?? params.search;
    if (typeof raw === 'string') {
        return raw;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return String(raw);
    }
    return '';
}
function normalizeStickerSearchLimit(params) {
    const raw = params.limit;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 10;
    }
    return 10;
}
function normalizeStickerId(params) {
    const raw = params.sticker_id ?? params.stickerId;
    if (typeof raw === 'string') {
        return raw;
    }
    if (Array.isArray(raw)) {
        return raw[0] ?? '';
    }
    return '';
}
export async function handleYuanbaoAction(action, params, context) {
    const normalized = (action === 'sticker' || action === 'react') ? 'sticker-send' : action;
    switch (normalized) {
        case 'sticker-search': {
            const query = normalizeStickerSearchQuery(params);
            const limit = normalizeStickerSearchLimit(params);
            const results = searchStickers(query, limit);
            return { ok: true, data: results };
        }
        case 'sticker-send': {
            const stickerId = normalizeStickerId(params);
            if (!stickerId) {
                return { ok: false, error: 'sticker_id is required' };
            }
            const queueManager = getOutboundQueue(context.account.accountId);
            const to = typeof params.to === 'string' && params.to.trim() ? params.to.trim() : context.toAccount;
            const { chatType, target, sessionKey } = parseTarget(to, context.account.accountId);
            const minCtx = {
                account: context.account,
                config: context.config,
                core: getYuanbaoRuntime(),
                log: { info: () => { }, warn: () => { }, error: () => { }, verbose: () => { } },
                wsClient: context.wsClient,
                groupCode: getGroupCode(),
            };
            const session = queueManager?.getOrCreateSession(sessionKey, {
                chatType,
                account: context.account,
                target,
                fromAccount: context.account.botId,
                ctx: minCtx,
            });
            if (!session) {
                logger.debug(`sendMedia: 未找到已有 session，基于 to 创建新 session 作为 fallback: ${context.toAccount}`);
                return { ok: false, error: `未找到已有 session，基于 to 创建新 session 作为 fallback: ${context.toAccount}` };
            }
            await session.push({ type: 'sticker', sticker_id: stickerId, text: '' });
            await session.flush();
            return { ok: true };
        }
        default:
            return { ok: false, error: `skip action: ${action}` };
    }
}
