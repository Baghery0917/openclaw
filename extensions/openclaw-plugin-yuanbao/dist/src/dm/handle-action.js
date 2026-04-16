import { parseTarget } from './targets.js';
import { sendDM } from './send-dm.js';
import { formatDMErrorForUser } from './error-handler.js';
import { enforceDMAccess, recordDMSend, DEFAULT_DM_ACCESS_POLICY } from './dm-access.js';
import { resolveYuanbaoAccount } from '../accounts.js';
import { createLog } from '../logger.js';
function readStringParam(params, key) {
    const val = params[key] ?? params[key.toLowerCase()];
    return typeof val === 'string' ? val.trim() : undefined;
}
function jsonResult(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data) }],
    };
}
function errorResult(error) {
    return jsonResult({ ok: false, error });
}
export function listActions() {
    return ['send'];
}
export function supportsAction(action) {
    return action === 'send';
}
export async function handleAction(ctx) {
    if (ctx.action !== 'send'
        || !ctx.toolContext?.currentChannelId.includes('group:')) {
        return null;
    }
    const log = createLog('dm:action');
    log.info('开始处理私聊发送');
    const to = readStringParam(ctx.params, 'to') ?? readStringParam(ctx.params, 'target');
    const message = readStringParam(ctx.params, 'message');
    if (!to) {
        log.error('私聊参数不完整');
        return errorResult({
            kind: 'invalid-target',
            detail: 'Missing "to" parameter. Use "user:<id>" or "@username" for DMs.',
        });
    }
    if (!message) {
        return errorResult({
            kind: 'invalid-target',
            detail: 'Missing "message" parameter.',
        });
    }
    const target = parseTarget(to);
    if (!target) {
        return errorResult({
            kind: 'invalid-target',
            detail: `Cannot parse target "${to}". Use "user:<id>" or "@username" format.`,
        });
    }
    if (target.kind === 'user') {
        log.info('处理 DM 发送', { to, targetId: target.id, senderId: ctx.requesterSenderId });
        const senderId = ctx.requesterSenderId ?? '';
        const accessResult = enforceDMAccess(senderId, target.id, message.length, DEFAULT_DM_ACCESS_POLICY);
        if (!accessResult.allowed) {
            log.error(`私聊访问被拒绝：${accessResult.reason}`);
            return errorResult({
                kind: 'invalid-target',
                detail: accessResult.reason ?? 'Access denied',
            });
        }
        let account;
        try {
            account = resolveYuanbaoAccount({ cfg: ctx.cfg, accountId: ctx.accountId ?? undefined });
        }
        catch (err) {
            log.error(`Failed to resolve account: ${err instanceof Error ? err.message : String(err)}`);
            return errorResult({
                kind: 'config-error',
                detail: `Failed to resolve account: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
        log.info('开始发送私聊');
        const groupCode = ctx.toolContext?.currentChannelId?.split(':').pop() ?? '';
        const result = await sendDM(to, message, { account, groupCode });
        if (!result.ok && result.error) {
            const display = target.displayName ?? `@${target.id}`;
            const errMsg = formatDMErrorForUser(result.error, display);
            log.error(errMsg);
            return jsonResult({
                ok: false,
                error: result.error,
                userMessage: errMsg,
            });
        }
        recordDMSend(senderId);
        log.info('私聊发送成功');
        return jsonResult({
            ok: true,
            messageId: result.messageId,
            type: 'dm',
            sentMessage: message,
            dmContext: `You have successfully sent a private message to user ${target.id} with content: "${message}". Remember this for future reference.`,
        });
    }
    return null;
}
