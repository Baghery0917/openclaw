import { YuanbaoWsClient } from './client.js';
import { createLog } from '../../logger.js';
import { resolveTraceContext } from '../../trace/context.js';
import { handleInboundMessage, } from '../../message-handler/index.js';
import { setActiveWsClient } from './runtime.js';
import { decodeInboundMessage } from './biz-codec.js';
import { getSignToken, forceRefreshSignToken } from '../api.js';
export async function startYuanbaoWsGateway(params) {
    const { account, config, abortSignal, log, runtime, statusSink } = params;
    const gwlog = createLog('ws', log, { botId: account.botId });
    const auth = await resolveWsAuth(account, log);
    const client = new YuanbaoWsClient({
        connection: {
            gatewayUrl: account.wsGatewayUrl,
            auth,
        },
        config: {
            maxReconnectAttempts: account.wsMaxReconnectAttempts,
        },
        callbacks: {
            onReady: (data) => {
                gwlog.info(`[${account.accountId}] WebSocket 已就绪: connectId=${data.connectId}`);
                statusSink?.({
                    running: true,
                    connected: true,
                    wsConnectId: data.connectId,
                    lastConnectedAt: Date.now(),
                });
            },
            onDispatch: (pushEvent) => {
                gwlog.debug(`[${account.accountId}] WS 推送: cmd=${pushEvent.cmd}, type=${pushEvent.type}`);
                handleWsDispatchEvent({ account, config, pushEvent, log, runtime, client, statusSink, abortSignal });
            },
            onStateChange: (state) => {
                gwlog.info(`[${account.accountId}] WS 状态: ${state}`);
                statusSink?.({
                    wsState: state,
                    connected: state === 'connected',
                    running: state !== 'disconnected',
                });
            },
            onError: (error) => {
                gwlog.error(`[${account.accountId}] WS 错误: ${error.message}`);
                statusSink?.({ lastError: error.message });
            },
            onClose: (code, reason) => {
                gwlog.info(`[${account.accountId}] WS 关闭: code=${code}, reason=${reason}`);
            },
            onKickout: (data) => {
                gwlog.warn(`[${account.accountId}] 被踢下线: status=${data.status}, reason=${data.reason}`);
                statusSink?.({ kickedOut: true, kickReason: data.reason });
            },
            onAuthFailed: async (code) => {
                gwlog.warn(`[${account.accountId}] 收到 onAuthFailed 回调(code=${code})，开始刷新 token`);
                const tokenData = await forceRefreshSignToken(account, log);
                const uid = tokenData.bot_id || account.botId || '';
                if (tokenData.bot_id) {
                    account.botId = tokenData.bot_id;
                }
                return {
                    bizId: 'ybBot',
                    uid,
                    source: tokenData.source || 'bot',
                    token: tokenData.token,
                    routeEnv: account.config?.routeEnv,
                };
            },
        },
        log: {
            info: msg => log?.info?.(msg),
            warn: msg => log?.warn?.(msg),
            error: msg => log?.error?.(msg),
            debug: msg => log?.debug?.(msg),
        },
    });
    client.connect();
    setActiveWsClient(account.accountId, client);
    return new Promise((resolve) => {
        const onAbort = () => {
            gwlog.info(`[${account.accountId}] 收到停止信号，断开 WebSocket`);
            setActiveWsClient(account.accountId, null);
            client.disconnect();
            statusSink?.({
                running: false,
                connected: false,
                lastStopAt: Date.now(),
            });
            resolve();
        };
        if (abortSignal.aborted) {
            onAbort();
            return;
        }
        abortSignal.addEventListener('abort', onAbort, { once: true });
    });
}
async function resolveWsAuth(account, log) {
    const mlog = createLog('ws', log, { botId: account.botId });
    mlog.info(`[${account.accountId}] resolveWsAuth 入参：`, {
        botId: account.botId,
        token: account.token,
    });
    if (account.token) {
        const uid = account.botId || '';
        mlog.info(`[${account.accountId}] 使用预配置的静态`, {
            uid,
            botId: account.botId,
            token: account.token,
        });
        return {
            bizId: 'ybBot',
            uid,
            source: 'bot',
            token: account.token,
            routeEnv: account.config?.routeEnv,
        };
    }
    const tokenData = await getSignToken(account, log);
    const uid = tokenData.bot_id || account.botId || '';
    if (tokenData.bot_id) {
        account.botId = tokenData.bot_id;
    }
    mlog.info(`[${account.accountId}] 签票完成 uid=${uid} (bot_id=${tokenData.bot_id}, botId=${account.botId})`);
    return {
        bizId: 'ybBot',
        uid,
        source: tokenData.source || 'bot',
        token: tokenData.token,
        routeEnv: account.config?.routeEnv,
    };
}
function parsePushContentToMsgBody(content) {
    if (typeof content === 'string' && content.trim()) {
        try {
            const parsed = JSON.parse(content);
            if (parsed?.msg_body && Array.isArray(parsed.msg_body)) {
                return parsed.msg_body;
            }
            if (parsed?.text) {
                return [{ msg_type: 'TIMTextElem', msg_content: { text: parsed.text } }];
            }
        }
        catch {
        }
        return [{ msg_type: 'TIMTextElem', msg_content: { text: content } }];
    }
    return undefined;
}
function inferChatType(msg) {
    if (msg.group_code)
        return 'group';
    const cmd = msg.callback_command;
    if (cmd === 'Group.CallbackAfterRecallMsg' || cmd === 'Group.CallbackAfterSendMsg')
        return 'group';
    return 'c2c';
}
function hasValidMsgFields(msg) {
    return Boolean(msg.callback_command || msg.from_account || msg.msg_body);
}
function decodeFromProtobuf(rawData, pushType) {
    const decoded = decodeInboundMessage(rawData);
    if (!decoded || !hasValidMsgFields(decoded))
        return null;
    createLog('ws').debug(`[${pushType}] WS 推送事件解析`, { ...decoded });
    return { msg: decoded, chatType: inferChatType(decoded) };
}
function decodeFromRawDataJson(rawData, pushType) {
    try {
        const rawJson = JSON.parse(new TextDecoder().decode(rawData));
        if (!rawJson || !hasValidMsgFields(rawJson))
            return null;
        const msg = rawJson;
        if (!msg.trace_id) {
            msg.trace_id = rawJson.log_ext?.trace_id;
        }
        createLog('ws').info(`[${pushType}] WS 推送事件解析`, { ...msg });
        return { msg, chatType: inferChatType(msg) };
    }
    catch {
        return null;
    }
}
function decodeFromContent(pushEvent) {
    const msgBody = parsePushContentToMsgBody(pushEvent.content);
    if (!msgBody)
        return null;
    let parsedContent = {};
    try {
        parsedContent = JSON.parse(pushEvent.content);
    }
    catch { }
    const logExt = parsedContent.log_ext;
    const chatType = parsedContent.group_code ? 'group' : 'c2c';
    return {
        msg: {
            callback_command: chatType === 'group' ? 'Group.CallbackAfterSendMsg' : 'C2C.CallbackAfterSendMsg',
            from_account: parsedContent.from_account,
            group_code: parsedContent.group_code,
            msg_body: msgBody,
            msg_key: parsedContent.msg_key,
            msg_seq: parsedContent.msg_seq,
            msg_time: parsedContent.msg_time,
            trace_id: logExt?.trace_id ?? parsedContent.trace_id,
            seq_id: parsedContent.seq_id,
        },
        chatType,
    };
}
export function wsPushToInboundMessage(pushEvent, log) {
    if (pushEvent.connData && pushEvent.connData.length > 0) {
        createLog('ws', log).debug(`[${pushEvent.type}] WS 推送事件解析 type=connData (connData.length=${pushEvent.connData.length})`);
        const pushType = String(pushEvent.type ?? '');
        const result = decodeFromProtobuf(pushEvent.connData, pushType);
        if (result)
            return result;
    }
    if (pushEvent.rawData && pushEvent.rawData.length > 0) {
        const pushType = String(pushEvent.type ?? 'rawData');
        createLog('ws', log).debug(`[${pushType}] WS 推送事件解析`);
        const result = decodeFromProtobuf(pushEvent.rawData, pushType)
            ?? decodeFromRawDataJson(pushEvent.rawData, pushType);
        if (result)
            return result;
        createLog('ws', log).warn(`[${pushType}] WS 推送事件解析失败`);
    }
    if (pushEvent.content) {
        createLog('ws', log).debug(`[${pushEvent.type || 'content'}] WS 推送事件解析, type=content`, { content: pushEvent.content });
        return decodeFromContent(pushEvent);
    }
    return null;
}
function handleWsDispatchEvent(params) {
    const { account, config, pushEvent, log: gwLog, runtime, client, statusSink, abortSignal } = params;
    const dlog = createLog('ws', gwLog, { botId: account.botId });
    dlog.debug(`[${account.accountId}][dispatch] cmd=${pushEvent.cmd}, module=${pushEvent.module}, msgId=${pushEvent.msgId}`);
    const converted = wsPushToInboundMessage(pushEvent, gwLog);
    if (!converted) {
        dlog.debug(`[${account.accountId}][dispatch] cmd=${pushEvent.cmd} (非消息事件，跳过)`);
        return;
    }
    const { msg, chatType } = converted;
    const traceContext = resolveTraceContext({
        traceId: msg.trace_id,
        seqId: msg.seq_id ?? msg.msg_seq,
    });
    msg.trace_id = traceContext.traceId;
    msg.seq_id = traceContext.seqId;
    dlog.debug(`[msg-trace] dispatch resolved: traceId=${traceContext.traceId}, seqId=${traceContext.seqId ?? '(none)'}, traceparent=${traceContext.traceparent}, sourceTraceId=${converted.msg.trace_id ?? '(none)'}, account=${account.accountId}`);
    dlog.info(`[${account.accountId}][dispatch] 收到 ${chatType === 'group' ? '群消息' : '私聊'}消息`);
    if (statusSink) {
        statusSink({ lastInboundAt: Date.now() });
    }
    if (!runtime) {
        dlog.warn(`[${account.accountId}][dispatch] PluginRuntime 未提供，无法处理消息`);
        return;
    }
    const handlerCtx = {
        account,
        config,
        core: runtime,
        log: {
            info: (m) => gwLog?.info?.(m),
            warn: (m) => gwLog?.warn?.(m),
            error: (m) => gwLog?.error?.(m),
            verbose: (m) => gwLog?.debug?.(m),
        },
        statusSink: statusSink,
        wsClient: client,
        traceContext,
        abortSignal,
    };
    handleInboundMessage({ ctx: handlerCtx, msg, chatType }).catch((err) => {
        dlog.error(`[${account.accountId}][dispatch] WS ${chatType === 'group' ? 'group ' : ''} message handler failed: ${String(err)}`);
    });
}
