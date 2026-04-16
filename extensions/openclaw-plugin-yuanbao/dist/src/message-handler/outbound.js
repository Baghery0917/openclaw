import { WS_HEARTBEAT } from '../yuanbao-server/ws/index.js';
import { createLog } from '../logger.js';
import { prepareOutboundContent, buildOutboundMsgBody } from './handlers/index.js';
import { getMember } from '../module/member.js';
import { YUANBAO_OVERFLOW_NOTICE_TEXT, stripOuterMarkdownFence, } from './context.js';
import { getOutboundQueue } from '../outbound-queue.js';
import { InMemoryTtlDb } from '../utils/ttl-db.js';
import { ChatType, getGroupCode, parseTarget } from '../targets.js';
import { runWithTraceContext } from '../trace/context.js';
const firstReplyRefDb = new InMemoryTtlDb({
    ttlMs: 60 * 1000,
    maxKeys: 100,
});
async function shouldAttachReplyRef(params) {
    const { account, refMsgId, groupCode, refFromAccount } = params;
    if (!refMsgId)
        return false;
    const mode = account.replyToMode;
    if (mode === 'off')
        return false;
    if (refFromAccount) {
        const yuanbaoUserId = await getMember(account.accountId).queryYuanbaoUserId(groupCode);
        if (yuanbaoUserId && refFromAccount === yuanbaoUserId)
            return false;
    }
    if (mode === 'all')
        return true;
    const dedupeKey = `${account.accountId}:${refMsgId}`;
    if (firstReplyRefDb.has(dedupeKey)) {
        return false;
    }
    firstReplyRefDb.set(dedupeKey, true);
    return true;
}
export async function sendYuanbaoMessageBody(params) {
    const { account, toAccount, msgBody, fromAccount, ctx } = params;
    const log = createLog('outbound', ctx?.log, { botId: account.botId });
    if (!ctx?.wsClient) {
        log.error('发送失败: WebSocket 客户端不可用');
        return { ok: false, error: 'wsClient not available' };
    }
    const msgRandom = Math.floor(Math.random() * 4294967295);
    try {
        const msgSeq = ctx.traceContext?.nextMsgSeq();
        log.debug(`[msg-trace] c2c outbound: traceId=${ctx.traceContext?.traceId ?? '(none)'}, seqId=${ctx.traceContext?.seqId ?? '(none)'}, msgSeq=${msgSeq ?? '(none)'}, to=${toAccount}`);
        const result = await ctx.wsClient.sendC2CMessage({
            to_account: toAccount,
            msg_body: msgBody,
            msg_random: msgRandom,
            ...(ctx.groupCode ? { group_code: ctx.groupCode } : {}),
            ...(fromAccount ? { from_account: fromAccount } : {}),
            ...(msgSeq !== undefined ? { msg_seq: msgSeq } : {}),
            ...(ctx.traceContext
                ? {
                    trace_id: ctx.traceContext.traceId,
                }
                : {}),
        });
        if (result.code !== 0) {
            log.error(`发送失败: code=${result.code}, message=${result.message}`);
            return { ok: false, error: result.message || `code: ${result.code}` };
        }
        log.info(`[私聊] 发送成功 -> ${toAccount}, code: ${result.code}, msgId: ${result.msgId}`);
        return { ok: true, messageId: result.msgId };
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error(`发送异常: ${errMsg}`);
        return { ok: false, error: errMsg };
    }
}
export async function sendYuanbaoMessage(params) {
    const { text, ...rest } = params;
    const items = prepareOutboundContent(text);
    const msgBody = buildOutboundMsgBody(items);
    return sendYuanbaoMessageBody({ ...rest, msgBody });
}
export async function sendYuanbaoGroupMessageBody(params) {
    const { account, groupCode, msgBody, fromAccount, refMsgId, refFromAccount, ctx } = params;
    const log = createLog('outbound', ctx?.log, { botId: account.botId });
    if (!ctx?.wsClient) {
        log.error('发送群消息失败: WebSocket 客户端不可用');
        return { ok: false, error: 'wsClient not available' };
    }
    const msgRandom = String(Math.floor(Math.random() * 4294967295));
    const attachReplyRef = await shouldAttachReplyRef({ account, refMsgId, groupCode, refFromAccount });
    try {
        const msgSeq = ctx.traceContext?.nextMsgSeq();
        log.debug(`[msg-trace] group outbound: traceId=${ctx.traceContext?.traceId ?? '(none)'}, seqId=${ctx.traceContext?.seqId ?? '(none)'}, msgSeq=${msgSeq ?? '(none)'}, groupCode=${groupCode}`);
        const result = await ctx.wsClient.sendGroupMessage({
            msg_id: refMsgId,
            group_code: groupCode,
            random: msgRandom,
            msg_body: msgBody,
            ...(fromAccount ? { from_account: fromAccount } : {}),
            ...(attachReplyRef ? { ref_msg_id: refMsgId } : {}),
            ...(msgSeq !== undefined ? { msg_seq: msgSeq } : {}),
            ...(ctx.traceContext
                ? {
                    trace_id: ctx.traceContext.traceId,
                }
                : {}),
        });
        if (result.code !== 0) {
            log.error(`群消息发送失败: code=${result.code}, message=${result.message}, msg=${result.msgId}`);
            return { ok: false, error: result.message || `code: ${result.code}` };
        }
        log.info(`群消息发送成功 -> ${groupCode}, msgId: ${result.msgId}`);
        return { ok: true, messageId: result.msgId };
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error(`群消息发送异常: ${errMsg}`);
        return { ok: false, error: errMsg };
    }
}
export async function sendYuanbaoGroupMessage(params) {
    const { text, groupCode, ...rest } = params;
    const items = prepareOutboundContent(text, groupCode, getMember(params.account.accountId));
    const msgBody = buildOutboundMsgBody(items);
    return sendYuanbaoGroupMessageBody({ ...rest, groupCode, msgBody });
}
export async function sendMsgBodyDirect(params) {
    const { account, config, target, msgBody, wsClient, core, refMsgId, refFromAccount, traceContext } = params;
    const { chatType, target: targetId } = parseTarget(target, account.accountId);
    const minCtx = {
        account,
        config,
        core,
        log: { info: () => { }, warn: () => { }, error: () => { }, verbose: () => { } },
        wsClient,
        groupCode: getGroupCode(),
        traceContext,
    };
    if (chatType === ChatType.GROUP) {
        return sendYuanbaoGroupMessageBody({
            account,
            groupCode: targetId,
            msgBody,
            fromAccount: account.botId,
            refMsgId,
            refFromAccount,
            ctx: minCtx,
        });
    }
    return sendYuanbaoMessageBody({
        account,
        toAccount: targetId,
        msgBody,
        fromAccount: account.botId,
        ctx: minCtx,
    });
}
export async function executeReply(params) {
    const { transport, ctx, account, core, replyRuntime, splitFinalText, overflowPolicy, ctxPayload, sessionKey, appendText, } = params;
    const rlog = createLog('outbound', ctx.log, { botId: account.botId });
    if (ctx.abortSignal?.aborted) {
        rlog.warn(`[${account.accountId}] 回复已中止，跳过执行`);
        return;
    }
    const L = transport.label;
    const queueManager = getOutboundQueue(account.accountId);
    const session = (queueManager && sessionKey)
        ? queueManager.getSession(sessionKey)
        : null;
    const collectedTexts = [];
    let hasFinalInfo = false;
    const dispatchReply = () => core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: replyRuntime.config,
        replyOptions: {
            disableBlockStreaming: replyRuntime.disableBlockStreaming,
            onAgentRunStart: () => {
                session?.emitReplyHeartbeat(WS_HEARTBEAT.RUNNING);
            },
            onToolStart: async () => {
                rlog.info('[OpenClaw] onToolStart');
                try {
                    if (session)
                        await session.drainNow();
                }
                catch (err) {
                    rlog.error('[OpenClaw] onToolStart drainNow 失败，跳过', { error: String(err) });
                }
            },
        },
        dispatcherOptions: {
            deliver: async (payload, info) => {
                if (ctx.abortSignal?.aborted) {
                    rlog.warn(`[deliver][${account.accountId}] 回复已中止，停止处理后续回复块`);
                    return;
                }
                rlog.info('[deliver] 收到回复数据', { kind: info.kind, model_output: payload.text });
                if (payload.isCompactionNotice) {
                    rlog.info('[deliver] CompactionNotice', { text: payload.text });
                    return;
                }
                if (hasFinalInfo) {
                    rlog.warn(`[deliver][${account.accountId}] 出现多次final回复，忽略后续回复 ${payload.text}`);
                }
                if (info.kind === 'final') {
                    hasFinalInfo = true;
                }
                const text = payload.text ?? '';
                if (session) {
                    if (text.trim()) {
                        await session.push({ type: 'text', text });
                    }
                    const mediaUrls = payload.mediaUrls ?? [];
                    for (const mediaUrl of mediaUrls) {
                        if (mediaUrl) {
                            await session.push({ type: 'media', mediaUrl });
                        }
                    }
                    return;
                }
                if (!text.trim()) {
                    return;
                }
                collectedTexts.push(text);
            },
            onError: (err, info) => {
                if (ctx.abortSignal?.aborted) {
                    rlog.warn(`[${account.accountId}] 回复已中止，忽略 onError`);
                    return;
                }
                rlog.error(`yuanbao ${L}${info.kind} reply failed`, { error: String(err) });
            },
        },
    });
    if (ctx.traceContext) {
        await runWithTraceContext(ctx.traceContext, dispatchReply);
    }
    else {
        await dispatchReply();
    }
    if (session) {
        if (appendText?.trim()) {
            await session.push({ type: 'text', text: `\n\n${appendText}` });
        }
        const hasSentContent = await session.flush();
        if (!hasSentContent) {
            const { fallbackReply } = account;
            if (fallbackReply) {
                rlog.info(`[${L}] AI 未返回回复内容（队列模式），使用兜底回复`);
                await sendTextReply({ text: fallbackReply, transport, ctx, overflowPolicy, splitFinalText, L, log: rlog });
            }
            else {
                rlog.warn(`[${L}] AI 未返回任何回复内容（队列模式）`);
            }
            return;
        }
        ctx.statusSink?.({ lastOutboundAt: Date.now() });
        session.emitReplyHeartbeat(WS_HEARTBEAT.FINISH);
        return;
    }
    if (collectedTexts.length === 0) {
        const { fallbackReply } = account;
        if (fallbackReply) {
            rlog.info(`[${L}] AI 未返回回复内容，使用兜底回复`);
            await sendTextReply({ text: fallbackReply, transport, ctx, overflowPolicy, splitFinalText, L, log: rlog });
        }
        else {
            rlog.warn(`[${L}] AI 未返回任何回复内容`);
        }
        return;
    }
    const rawFinal = collectedTexts.join('\n\n');
    const strippedFinal = stripOuterMarkdownFence(rawFinal);
    const finalText = appendText?.trim()
        ? `${strippedFinal}\n\n${appendText}`
        : strippedFinal;
    await sendTextReply({ text: finalText, transport, ctx, overflowPolicy, splitFinalText, L, log: rlog });
    ctx.statusSink?.({ lastOutboundAt: Date.now() });
}
async function sendTextReply(params) {
    const { text, transport, overflowPolicy, splitFinalText, L, log, groupCode, memberInst } = params;
    const sendChunk = async (chunk) => {
        const items = prepareOutboundContent(chunk, groupCode, memberInst);
        const result = transport.sendItems && items.some(i => i.type !== 'text')
            ? await transport.sendItems({ items })
            : await transport.sendText({ text: chunk });
        if (!result.ok)
            log.error(`[${L}] 发送文本失败: ${result.error}`);
        return result.ok;
    };
    const chunks = splitFinalText(text);
    if (chunks.length <= 1) {
        await sendChunk(text);
        return;
    }
    if (overflowPolicy === 'stop') {
        await sendChunk(chunks[0]);
        await transport.sendText({ text: YUANBAO_OVERFLOW_NOTICE_TEXT });
        return;
    }
    for (const chunk of chunks) {
        if (!await sendChunk(chunk))
            break;
    }
}
