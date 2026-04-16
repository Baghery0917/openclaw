import { recordPendingHistoryEntryIfEnabled, buildPendingHistoryContextFromMap, clearHistoryEntriesIfEnabled, resolveControlCommandGate, } from 'openclaw/plugin-sdk/mattermost';
import { downloadMediasToLocalFiles } from '../media.js';
import { resolveOutboundSenderAccount, rewriteSlashCommand, YUANBAO_FINAL_TEXT_CHUNK_LIMIT, YUANBAO_MARKDOWN_HINT, } from './context.js';
import { extractTextFromMsgBody } from './extract.js';
import { sendYuanbaoMessage, sendYuanbaoMessageBody, sendYuanbaoGroupMessageBody, executeReply, } from './outbound.js';
import { buildOutboundMsgBody, prepareOutboundContent } from './handlers/index.js';
import { parseQuoteFromCloudCustomData, formatQuoteContext } from './quote.js';
import { getMember } from '../module/member.js';
import { createLog } from '../logger.js';
import { getOutboundQueue } from '../outbound-queue.js';
import { performUpgrade } from '../commands/upgrade/upgrade.js';
import { parseUpgradeCommand } from '../commands/upgrade/index.js';
import { dispatchSystemCallback } from './system-callbacks.js';
import { chatHistories, chatMediaHistories, recordMediaHistory, } from './chat-history.js';
import './callbacks/recall.js';
import { setGroupCode } from '../targets.js';
import { getPluginVersion } from '../utils/get-env.js';
import { createReplyHeartbeatController } from '../module/reply-heartbeat.js';
import { WS_HEARTBEAT } from '../yuanbao-server/ws/index.js';
const conversationQueues = new Map();
function enqueueForConversation(key, task) {
    const prev = conversationQueues.get(key) ?? Promise.resolve();
    const taskResult = prev.then(() => task());
    const queued = taskResult.catch(() => undefined);
    conversationQueues.set(key, queued);
    queued.finally(() => {
        if (conversationQueues.get(key) === queued) {
            conversationQueues.delete(key);
        }
    });
    return taskResult;
}
const GROUP_PUBLIC_COMMANDS = new Set([]);
function buildReplyRuntimeConfig(config, account) {
    return {
        config,
        disableBlockStreaming: account.disableBlockStreaming,
    };
}
function resolveYuanbaoCommandAuth(params) {
    const { core, config, rawBody, senderId, account } = params;
    const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
        cfg: config,
        surface: 'yuanbao',
    });
    const hasControlCommand = core.channel.text.hasControlCommand(rawBody, config);
    const dmPolicy = account.config.dm?.policy ?? 'open';
    const rawAllowFrom = (account.config.dm?.allowFrom ?? []).map(String);
    const effectiveAllowFrom = (dmPolicy === 'open' && !rawAllowFrom.includes('*'))
        ? [...rawAllowFrom, '*']
        : rawAllowFrom;
    const senderAllowed = effectiveAllowFrom.includes('*') || effectiveAllowFrom.includes(senderId);
    const useAccessGroups = config.commands?.useAccessGroups !== false;
    return resolveControlCommandGate({
        useAccessGroups,
        authorizers: [{ configured: effectiveAllowFrom.length > 0, allowed: senderAllowed }],
        allowTextCommands,
        hasControlCommand,
    });
}
function getHistoryMedias(groupCode, fromAccount, quoteInfo) {
    const historyMedias = [];
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const history = chatHistories.get(groupCode) ?? [];
    const now = Date.now();
    const recentHistory = history.filter(entry => entry.timestamp == null || now - entry.timestamp <= TEN_MINUTES_MS);
    const lastUserHistory = recentHistory.filter(entry => entry.sender === fromAccount).pop();
    if (lastUserHistory) {
        historyMedias.push(...(lastUserHistory.medias ?? []));
    }
    if (quoteInfo?.id) {
        const mediaList = chatMediaHistories.get(groupCode) ?? [];
        const quoteMedia = mediaList.filter(entry => entry.messageId === quoteInfo.id).pop();
        if (quoteMedia) {
            const existingUrls = new Set(historyMedias.map(m => m.url));
            historyMedias.push(...quoteMedia.medias.filter(m => !existingUrls.has(m.url)));
        }
    }
    return historyMedias;
}
function buildGroupHistoryContext(params) {
    const { core, groupCode, body, historyLimit, envelopeOptions } = params;
    const combinedBody = buildPendingHistoryContextFromMap({
        historyMap: chatHistories,
        historyKey: groupCode,
        limit: historyLimit,
        currentMessage: body,
        formatEntry: entry => core.channel.reply.formatAgentEnvelope({
            channel: 'YUANBAO',
            from: `group:${groupCode}:${entry.sender}`,
            timestamp: entry.timestamp,
            body: entry.body,
            envelope: envelopeOptions,
        }),
    });
    const inboundHistory = historyLimit > 0
        ? (chatHistories.get(groupCode) ?? []).map(entry => ({
            sender: entry.sender,
            body: entry.body,
            timestamp: entry.timestamp,
        }))
        : undefined;
    return { combinedBody, inboundHistory };
}
function isSkippableBracketPlaceholder(rawBody, mediaCount) {
    if (mediaCount > 0)
        return false;
    const t = rawBody.trim();
    if (!/^\[.+\]$/.test(t))
        return false;
    if (/^\[EMOJI/i.test(t))
        return false;
    return true;
}
async function handleC2CMessage(params) {
    const { ctx, msg } = params;
    const { core, config, account } = ctx;
    if (msg.private_from_group_code) {
        ctx.groupCode = msg.private_from_group_code;
        setGroupCode(ctx.groupCode);
    }
    const fromAccount = msg.from_account?.trim() || 'unknown';
    const senderNickname = msg.sender_nickname?.trim() || undefined;
    const outboundSender = resolveOutboundSenderAccount(account);
    const log = createLog('inbound', ctx.log, { botId: account.botId });
    if (outboundSender && fromAccount === outboundSender) {
        log.info(`跳过机器人自身消息 <- ${fromAccount}`);
        return;
    }
    const { rawBody, medias } = extractTextFromMsgBody(ctx, msg.msg_body);
    log.info(`收到消息 <- ${fromAccount}${senderNickname ? `(${senderNickname})` : ''}, msgKey: ${msg.msg_key}`);
    const quoteInfo = parseQuoteFromCloudCustomData(msg.cloud_custom_data);
    if (quoteInfo) {
        log.info(`检测到引用消息, 引用来自: ${quoteInfo.sender_nickname || quoteInfo.sender_id || 'unknown'}`);
        log.debug('引用内容', { quote: quoteInfo.desc || '' });
    }
    if (!rawBody.trim()) {
        log.warn('消息内容为空，跳过处理');
        return;
    }
    if (isSkippableBracketPlaceholder(rawBody, medias.length)) {
        log.debug('占位符消息，跳过处理', { user_input: rawBody, fromAccount });
        return;
    }
    const upgradeCmd = parseUpgradeCommand(rawBody);
    if (upgradeCmd.matched) {
        log.info(`============== 收到 ${rawBody.trim()} 命令 ==============`, msg);
        if (!msg.bot_owner_id || msg.from_account !== msg.bot_owner_id) {
            log.warn(`非 Owner 尝试执行 ${rawBody.trim()}，已拒绝`, { fromAccount });
            await sendYuanbaoMessage({
                account,
                toAccount: fromAccount,
                text: '⚠️ 您无权执行此操作，仅 Bot 创建人可以执行此操作。',
                fromAccount: outboundSender,
                ctx,
            });
            return;
        }
        log.info(`Owner 触发升级命令 ${rawBody.trim()}`, { fromAccount, targetVersion: upgradeCmd.version });
        const heartbeat = createReplyHeartbeatController({ meta: { ctx, account, toAccount: fromAccount, groupCode: ctx.groupCode } });
        heartbeat.emit(WS_HEARTBEAT.RUNNING);
        const heartbeatKeepaliveTimer = setInterval(() => heartbeat.emit(WS_HEARTBEAT.RUNNING), 30_000);
        const sendMsg = (text) => sendYuanbaoMessage({ account, toAccount: fromAccount, text, fromAccount: outboundSender, ctx });
        try {
            const result = await performUpgrade(config, account.accountId, sendMsg, upgradeCmd.version);
            if (result)
                await sendMsg(result);
        }
        finally {
            clearInterval(heartbeatKeepaliveTimer);
            heartbeat.emit(WS_HEARTBEAT.FINISH);
            heartbeat.stop();
        }
        return;
    }
    if (rawBody.trim().startsWith('/issue-log')) {
        log.info('============== 收到 /issue-log 命令 ==============', msg);
        if (!msg.bot_owner_id || msg.from_account !== msg.bot_owner_id) {
            log.warn('非 Owner 尝试执行 /issue-log，已拒绝', { fromAccount });
            await sendYuanbaoMessage({
                account,
                toAccount: fromAccount,
                text: '⚠️ 您无权导出日志，请联系 Bot 创建人操作。',
                fromAccount: outboundSender,
                ctx,
            });
            return;
        }
        log.info('Owner 触发日志导出命令', { fromAccount });
        await sendYuanbaoMessage({
            account,
            toAccount: fromAccount,
            text: '📦 正在导出问题日志并压缩打包发送，请稍后...',
            fromAccount: outboundSender,
            ctx,
        });
    }
    const { commandAuthorized } = resolveYuanbaoCommandAuth({
        core, config, rawBody, senderId: fromAccount, account,
    });
    const rewrittenBody = rewriteSlashCommand(rawBody, (orig, rewritten) => {
        log.info(`命令改写: "${orig}" -> "${rewritten}"`);
    });
    const bodyWithQuote = quoteInfo
        ? `${formatQuoteContext(quoteInfo)}\n${rewrittenBody}`
        : rewrittenBody;
    log.debug(`开始处理消息, 账号: ${account.accountId}`);
    const { mediaPaths, mediaTypes } = await downloadMediasToLocalFiles(medias, account, core, {
        verbose: msg => log.debug(msg),
        warn: msg => log.warn(msg),
    });
    const route = core.channel.routing.resolveAgentRoute({
        cfg: config,
        channel: 'yuanbao',
        accountId: account.accountId,
        peer: { kind: 'direct', id: fromAccount },
    });
    log.debug(`processing message from ${fromAccount}, agentId=${route.agentId}`);
    const fromLabel = `direct:${fromAccount}`;
    const storePath = core.channel.session.resolveStorePath(config.session?.store, {
        agentId: route.agentId,
    });
    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
    const previousTimestamp = core.channel.session.readSessionUpdatedAt({
        storePath,
        sessionKey: route.sessionKey,
    });
    const body = core.channel.reply.formatAgentEnvelope({
        channel: 'YUANBAO',
        from: fromLabel,
        previousTimestamp,
        envelope: envelopeOptions,
        body: bodyWithQuote,
    });
    log.debug(`[msg-trace] inject c2c inbound context: traceId=${ctx.traceContext?.traceId ?? '(none)'}, traceparent=${ctx.traceContext?.traceparent ?? '(none)'}, seqId=${ctx.traceContext?.seqId ?? '(none)'}, from=${fromAccount}`);
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: body,
        RawBody: bodyWithQuote,
        CommandBody: bodyWithQuote,
        From: `yuanbao:direct:${fromAccount}`,
        To: `yuanbao:direct:${fromAccount}`,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        ChatType: 'direct',
        ConversationLabel: fromLabel,
        SenderName: senderNickname || fromAccount,
        SenderId: fromAccount,
        Provider: 'yuanbao',
        Surface: 'yuanbao',
        MessageSid: msg.msg_id,
        TraceId: ctx.traceContext?.traceId,
        Traceparent: ctx.traceContext?.traceparent,
        SeqId: ctx.traceContext?.seqId,
        OriginatingChannel: 'yuanbao',
        OriginatingTo: `yuanbao:direct:${fromAccount}`,
        CommandAuthorized: commandAuthorized,
        ...(account.markdownHintEnabled && { GroupSystemPrompt: YUANBAO_MARKDOWN_HINT }),
        ...(mediaPaths.length > 0 && { MediaPaths: mediaPaths, MediaPath: mediaPaths[0] }),
        ...(mediaTypes.length > 0 && { MediaTypes: mediaTypes, MediaType: mediaTypes[0] }),
    });
    await core.channel.session.recordInboundSession({
        storePath,
        sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
        ctx: ctxPayload,
        onRecordError: (err) => {
            log.error('failed updating session meta', { error: String(err) });
        },
    });
    const tableMode = 'off';
    const finalTextChunkLimit = core.channel.text.resolveTextChunkLimit(config, 'yuanbao', account.accountId, {
        fallbackLimit: YUANBAO_FINAL_TEXT_CHUNK_LIMIT,
    });
    const splitFinalText = (text) => core.channel.text.chunkMarkdownText(text, finalTextChunkLimit);
    log.debug(`开始生成回复 -> ${fromAccount}`);
    log.debug('转发给 OpenClaw', {
        user_input: rawBody,
        sessionKey: ctxPayload.SessionKey,
        from: ctxPayload.From,
    });
    const transport = {
        label: '',
        sendText: p => sendYuanbaoMessage({
            account,
            toAccount: fromAccount,
            text: p.text,
            fromAccount: outboundSender,
            ctx,
        }),
        sendItems: p => sendYuanbaoMessageBody({
            account,
            toAccount: fromAccount,
            msgBody: buildOutboundMsgBody(p.items),
            fromAccount: outboundSender,
            ctx,
        }),
    };
    const outboundSessionKey = `direct:${fromAccount}`;
    const msgId = msg.msg_id ?? String(msg.msg_seq ?? '');
    const queueManager = getOutboundQueue(account.accountId);
    if (queueManager) {
        queueManager.registerSession(outboundSessionKey, {
            msgId,
            chatType: 'c2c',
            account,
            target: fromAccount,
            toAccount: fromAccount,
            fromAccount: outboundSender,
            ctx,
            mergeOnFlush: account.disableBlockStreaming,
        });
        log.debug(`[${outboundSessionKey}] 出站队列 session 已注册，msgId: ${msgId}`);
    }
    const replyRuntime = buildReplyRuntimeConfig(config, account);
    await executeReply({
        transport,
        ctx,
        account,
        core,
        config,
        ctxPayload,
        replyRuntime,
        tableMode,
        splitFinalText,
        overflowPolicy: account.overflowPolicy,
        sessionKey: outboundSessionKey,
        appendText: getAppendText(rawBody),
    });
    log.info(`消息处理完成 <- ${fromAccount}`);
}
async function handleGroupMessage(params) {
    const { ctx, msg } = params;
    const { core } = ctx;
    const { config } = ctx;
    const { account } = ctx;
    const groupCode = msg.group_code?.trim() || 'unknown';
    const fromAccount = msg.from_account?.trim() || 'unknown';
    const senderNickname = msg.sender_nickname?.trim() || undefined;
    const outboundSender = resolveOutboundSenderAccount(account);
    const glog = createLog('inbound', ctx.log, { botId: account.botId });
    setGroupCode(groupCode);
    if (outboundSender && fromAccount === outboundSender) {
        glog.info('跳过机器人自身消息', { groupCode, fromAccount });
        return;
    }
    const { rawBody, isAtBot, medias, mentions } = extractTextFromMsgBody(ctx, msg.msg_body);
    glog.info(`收到群消息 <- group:${groupCode}, from: ${fromAccount}${senderNickname ? `(${senderNickname})` : ''}, msgSeq: ${msg.msg_seq}, isAtBot: ${isAtBot}`);
    const quoteInfo = parseQuoteFromCloudCustomData(msg.cloud_custom_data);
    if (quoteInfo) {
        glog.info(`群消息检测到引用消息, 引用来自: ${quoteInfo.sender_nickname || quoteInfo.sender_id || 'unknown'}`);
        glog.debug('引用内容', { quote: quoteInfo.desc || '' });
    }
    getMember(account.accountId).recordUser(groupCode, fromAccount, senderNickname || fromAccount);
    if (!rawBody.trim() && medias.length === 0 && !isAtBot) {
        glog.warn('群消息内容为空，跳过处理');
        return;
    }
    glog.debug(`开始处理群消息, 账号: ${account.accountId}, group: ${groupCode}`);
    const { historyLimit } = account;
    const requireMention = account.requireMention !== false;
    if (requireMention && !isAtBot) {
        glog.info(`非@机器人消息，已记录到群历史上下文，跳过回复 <- group:${groupCode}, from: ${fromAccount}`);
        if (historyLimit > 0) {
            recordPendingHistoryEntryIfEnabled({
                historyMap: chatHistories,
                historyKey: groupCode,
                limit: historyLimit,
                entry: {
                    sender: fromAccount,
                    body: `${fromAccount}: ${rawBody}`,
                    timestamp: Date.now(),
                    messageId: msg.msg_id ?? String(msg.msg_seq ?? ''),
                    medias: medias.length > 0 ? medias : undefined,
                },
            });
        }
        if (medias.length > 0) {
            recordMediaHistory(groupCode, {
                sender: fromAccount,
                messageId: msg.msg_id ?? String(msg.msg_seq ?? ''),
                timestamp: Date.now(),
                medias,
            });
        }
        return;
    }
    if (parseUpgradeCommand(rawBody).matched) {
        glog.info('派中不支持升级命令，返回提示');
        await sendYuanbaoGroupMessageBody({
            account,
            groupCode,
            msgBody: buildOutboundMsgBody(prepareOutboundContent(`派中暂不支持该命令，请 Bot 创建人在私聊发送 ${rawBody.trim()} 进行升级`, groupCode, getMember(account.accountId))),
            fromAccount: outboundSender,
            ctx,
        });
        return;
    }
    if (rawBody.trim().startsWith('/issue-log')) {
        if (!msg.bot_owner_id || msg.from_account !== msg.bot_owner_id) {
            glog.warn('非 Owner 尝试执行 /issue-log，已拒绝', { fromAccount, groupCode });
            await sendYuanbaoGroupMessageBody({
                account,
                groupCode,
                msgBody: buildOutboundMsgBody(prepareOutboundContent('群聊暂不支持该命令，请 bot owner 私聊发送 /issue-log 导出日志', groupCode, getMember(account.accountId))),
                fromAccount: outboundSender,
                ctx,
            });
            return;
        }
        glog.info('Owner 在群聊触发 /issue-log，引导私聊执行', { fromAccount, groupCode });
        await sendYuanbaoGroupMessageBody({
            account,
            groupCode,
            msgBody: buildOutboundMsgBody(prepareOutboundContent('群聊暂不支持该命令，请 bot owner 私聊发送 /issue-log 导出日志', groupCode, getMember(account.accountId))),
            fromAccount: outboundSender,
            ctx,
        });
        return;
    }
    const { commandAuthorized, shouldBlock: commandShouldBlock } = resolveYuanbaoCommandAuth({
        core, config, rawBody, senderId: fromAccount, account,
    });
    if (commandShouldBlock) {
        glog.info(`群控制命令未授权，丢弃 <- group:${groupCode}, from: ${fromAccount}`);
        return;
    }
    const hasRegisteredCommand = core.channel.text.hasControlCommand(rawBody, config);
    if (hasRegisteredCommand) {
        const cmdMatch = rawBody.trim().match(/^\/([a-z_-]+)/i);
        if (cmdMatch) {
            const cmdName = cmdMatch[1].toLowerCase();
            const isOwner = Boolean(msg.bot_owner_id && msg.from_account === msg.bot_owner_id);
            if (!GROUP_PUBLIC_COMMANDS.has(cmdName) && !isOwner) {
                glog.info(`群命令 /${cmdName} 仅限 owner，丢弃 <- group:${groupCode}, from: ${fromAccount}, owner: ${msg.bot_owner_id}`);
                await sendYuanbaoGroupMessageBody({
                    account,
                    groupCode,
                    msgBody: buildOutboundMsgBody(prepareOutboundContent(`⚠️ /${cmdName} 仅限创建者${!msg?.bot_owner_id ? '并且在私聊模式下' : ''}使用哦~`, groupCode, getMember(account.accountId))),
                    fromAccount: outboundSender,
                    refMsgId: msg.msg_id || msg.msg_key || undefined,
                    refFromAccount: fromAccount,
                    ctx,
                });
                return;
            }
        }
    }
    const rewrittenBody = rewriteSlashCommand(rawBody, (orig, rewritten) => {
        glog.info(`群命令改写: "${orig}" -> "${rewritten}"`);
    });
    const mentionsContext = mentions && mentions.length > 0
        ? `\n[消息中@了以下用户: ${mentions.map(m => `${m.text}(userId: ${m.userId})`).join(', ')}]`
        : '';
    const bodyWithQuote = quoteInfo
        ? `${formatQuoteContext(quoteInfo)}\n${rewrittenBody}${mentionsContext}`
        : `${rewrittenBody}${mentionsContext}`;
    glog.debug(`开始处理群消息, 账号: ${account.accountId}, group: ${groupCode}`);
    const historyMedias = getHistoryMedias(groupCode, fromAccount, quoteInfo);
    if (medias.length > 0) {
        recordMediaHistory(groupCode, {
            sender: fromAccount,
            messageId: msg.msg_id ?? String(msg.msg_seq ?? ''),
            timestamp: Date.now(),
            medias,
        });
    }
    const allMedias = [...historyMedias, ...medias];
    const { mediaPaths, mediaTypes } = await downloadMediasToLocalFiles(allMedias, account, core, {
        verbose: msg => glog.debug(msg),
        warn: msg => glog.warn(msg),
    });
    const route = core.channel.routing.resolveAgentRoute({
        cfg: config,
        channel: 'yuanbao',
        accountId: account.accountId,
        peer: { kind: 'group', id: groupCode },
    });
    glog.debug(`processing group message from ${fromAccount} in ${groupCode}, agentId=${route.agentId}`);
    const groupLabel = `group:${groupCode}`;
    const storePath = core.channel.session.resolveStorePath(config.session?.store, {
        agentId: route.agentId,
    });
    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
    const previousTimestamp = core.channel.session.readSessionUpdatedAt({
        storePath,
        sessionKey: route.sessionKey,
    });
    const body = core.channel.reply.formatAgentEnvelope({
        channel: 'YUANBAO',
        from: groupLabel,
        timestamp: new Date(),
        previousTimestamp,
        envelope: envelopeOptions,
        body: bodyWithQuote,
    });
    const { combinedBody, inboundHistory } = buildGroupHistoryContext({
        core,
        groupCode,
        body,
        historyLimit,
        envelopeOptions,
    });
    glog.debug(`[msg-trace] inject group inbound context: traceId=${ctx.traceContext?.traceId ?? '(none)'}, traceparent=${ctx.traceContext?.traceparent ?? '(none)'}, seqId=${ctx.traceContext?.seqId ?? '(none)'}, groupCode=${groupCode}`);
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: combinedBody,
        BodyForAgent: bodyWithQuote,
        InboundHistory: inboundHistory,
        RawBody: bodyWithQuote,
        CommandBody: bodyWithQuote,
        From: `yuanbao:group:${groupCode}`,
        To: `yuanbao:group:${groupCode}`,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        ChatType: 'group',
        ConversationLabel: groupLabel,
        GroupSubject: msg.group_name || undefined,
        SenderName: senderNickname || fromAccount,
        SenderId: fromAccount,
        Provider: 'yuanbao',
        Surface: 'yuanbao',
        MessageSid: msg.msg_id ?? String(msg.msg_seq ?? ''),
        TraceId: ctx.traceContext?.traceId,
        Traceparent: ctx.traceContext?.traceparent,
        SeqId: ctx.traceContext?.seqId,
        OriginatingChannel: 'yuanbao',
        OriginatingTo: `yuanbao:group:${groupCode}`,
        CommandAuthorized: commandAuthorized,
        ...(account.markdownHintEnabled && { GroupSystemPrompt: YUANBAO_MARKDOWN_HINT }),
        ...(mediaPaths.length > 0 && { MediaPaths: mediaPaths, MediaPath: mediaPaths[0] }),
        ...(mediaTypes.length > 0 && { MediaTypes: mediaTypes, MediaType: mediaTypes[0] }),
    });
    await core.channel.session.recordInboundSession({
        storePath,
        sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
        ctx: ctxPayload,
        onRecordError: (err) => {
            glog.error('failed updating group session meta', { error: String(err) });
        },
    });
    const tableMode = 'off';
    const finalTextChunkLimit = core.channel.text.resolveTextChunkLimit(config, 'yuanbao', account.accountId, {
        fallbackLimit: YUANBAO_FINAL_TEXT_CHUNK_LIMIT,
    });
    const splitFinalText = (text) => core.channel.text.chunkMarkdownText(text, finalTextChunkLimit);
    glog.debug(`开始生成群回复 -> group:${groupCode}`);
    const refMsgId = msg.msg_id || msg.msg_key || undefined;
    const transport = {
        label: '群',
        sendText: (p) => {
            const contentItems = prepareOutboundContent(p.text, groupCode, getMember(account.accountId));
            const contentMsgBody = buildOutboundMsgBody(contentItems);
            return sendYuanbaoGroupMessageBody({
                account,
                groupCode,
                msgBody: contentMsgBody,
                fromAccount: outboundSender,
                refMsgId,
                refFromAccount: fromAccount,
                ctx,
            });
        },
        sendItems: (p) => {
            const contentMsgBody = buildOutboundMsgBody(p.items);
            return sendYuanbaoGroupMessageBody({
                account,
                groupCode,
                msgBody: contentMsgBody,
                fromAccount: outboundSender,
                refMsgId,
                refFromAccount: fromAccount,
                ctx,
            });
        },
    };
    const outboundGroupSessionKey = `group:${groupCode}`;
    const groupMsgId = msg.msg_id ?? String(msg.msg_seq ?? '');
    const groupQueueManager = getOutboundQueue(account.accountId);
    if (groupQueueManager) {
        groupQueueManager.registerSession(outboundGroupSessionKey, {
            msgId: groupMsgId,
            chatType: 'group',
            account,
            target: groupCode,
            toAccount: fromAccount,
            fromAccount: outboundSender,
            refMsgId,
            refFromAccount: fromAccount,
            ctx,
            mergeOnFlush: account.disableBlockStreaming,
        });
        glog.debug(`[${outboundGroupSessionKey}] 群出站队列 session 已注册，msgId: ${groupMsgId}`);
    }
    const replyRuntime = buildReplyRuntimeConfig(config, account);
    try {
        await executeReply({
            transport,
            ctx,
            account,
            core,
            config,
            ctxPayload,
            replyRuntime,
            tableMode,
            splitFinalText,
            overflowPolicy: account.overflowPolicy,
            sessionKey: outboundGroupSessionKey,
            groupCode,
            appendText: getAppendText(rawBody),
        });
    }
    catch (err) {
        const session = groupQueueManager?.getSession(outboundGroupSessionKey);
        session?.abort();
        throw err;
    }
    clearHistoryEntriesIfEnabled({
        historyMap: chatHistories,
        historyKey: groupCode,
        limit: historyLimit,
    });
    glog.info(`群消息处理完成 <- group:${groupCode}, from: ${fromAccount}`);
}
function getAppendText(rawBody) {
    if (rawBody.trim().startsWith('/status')) {
        return `🤖 Bot: yuanbaobot(${getPluginVersion()})`;
    }
    return '';
}
export async function handleInboundMessage(params) {
    const { ctx, msg, chatType } = params;
    if (dispatchSystemCallback({ ctx, msg, chatType }))
        return;
    const convKey = chatType === 'group'
        ? `group:${ctx.account.accountId}:${msg.group_code?.trim() || 'unknown'}`
        : `c2c:${ctx.account.accountId}:${msg.from_account?.trim() || 'unknown'}`;
    return enqueueForConversation(convKey, () => (chatType === 'group'
        ? handleGroupMessage({ ctx, msg })
        : handleC2CMessage({ ctx, msg })));
}
