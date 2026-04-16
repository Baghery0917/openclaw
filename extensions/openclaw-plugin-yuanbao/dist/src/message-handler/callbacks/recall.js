import { chatHistories } from '../chat-history.js';
import { createLog } from '../../logger.js';
function enqueueRecallSystemEvent(params) {
    const { core, sessionKey, conversationId, messageId } = params;
    const eventText = [
        `[yuanbao] One historical user message was recalled; only message_id="${messageId}" is void (not necessarily the latest turn).`,
        'Do not quote or ground on it; ignore stale transcript for that id. Keep past assistant replies; no tool rollback.',
    ].join('\n');
    core.system.enqueueSystemEvent(eventText, {
        sessionKey,
        contextKey: `yuanbao:recall:${conversationId}:${messageId}`,
    });
}
export function handleGroupRecall(ctx, msg) {
    const { core, account } = ctx;
    const log = createLog('recall', ctx.log);
    const groupCode = msg.group_code?.trim() || 'unknown';
    const seqList = msg.recall_msg_seq_list;
    if (!seqList || seqList.length === 0) {
        log.warn('[recall] group msg_seq_list 为空，跳过');
        return;
    }
    const route = core.channel.routing.resolveAgentRoute({
        cfg: ctx.config,
        channel: 'yuanbao',
        accountId: account.accountId,
        peer: { kind: 'group', id: groupCode },
    });
    const where = msg.group_name
        ? `group "${msg.group_name}" (${groupCode})`
        : `group ${groupCode}`;
    for (const seq of seqList) {
        const messageId = seq.msg_id || String(seq.msg_seq ?? '');
        if (!messageId)
            continue;
        const history = chatHistories.get(groupCode);
        const idx = history
            ? history.findIndex(e => e.messageId === messageId)
            : -1;
        if (history && idx !== -1) {
            history.splice(idx, 1);
            log.info(`[recall] 群消息 ${messageId} 已从 history 删除（未被 AI 消费）`, { groupCode });
        }
        else {
            log.info(`[recall] 群消息 ${messageId} 不在 history，注入系统事件`, {
                groupCode,
            });
            enqueueRecallSystemEvent({
                core,
                sessionKey: route.sessionKey,
                conversationId: groupCode,
                where,
                messageId,
            });
        }
    }
}
export function handleC2CRecall(ctx, msg) {
    const { core, account } = ctx;
    const log = createLog('recall', ctx.log);
    const fromAccount = msg.from_account?.trim() || 'unknown';
    const seqList = msg.msg_id
        ? [{ msg_id: msg.msg_id, msg_seq: msg.msg_seq }]
        : [];
    if (!seqList || seqList.length === 0) {
        log.warn('[recall] c2c msg_seq_list 为空，跳过');
        return;
    }
    const route = core.channel.routing.resolveAgentRoute({
        cfg: ctx.config,
        channel: 'yuanbao',
        accountId: account.accountId,
        peer: { kind: 'direct', id: fromAccount },
    });
    for (const seq of seqList) {
        const messageId = seq.msg_id || String(seq.msg_seq ?? '');
        if (!messageId)
            continue;
        log.info(`[recall] C2C 消息 ${messageId} 被撤回，注入系统事件`, {
            fromAccount,
        });
        enqueueRecallSystemEvent({
            core,
            sessionKey: route.sessionKey,
            conversationId: fromAccount,
            where: `direct chat with ${fromAccount}`,
            messageId,
        });
    }
}
