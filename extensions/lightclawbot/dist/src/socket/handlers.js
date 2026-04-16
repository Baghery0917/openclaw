/**
 * LightClaw — Socket.IO 事件处理器
 *
 * 将 socket 事件监听（message:private、history:request、sessions:request）
 * 从 gateway 主逻辑中解耦。
 *
 * 所有出站 socket.emit 通过 ReliableEmitter 实现 ACK 确认 + 自动重试。
 */
import { CHANNEL_KEY, EVENT_MESSAGE_PRIVATE, EVENT_HISTORY_REQUEST, EVENT_HISTORY_RESPONSE, EVENT_SESSIONS_REQUEST, EVENT_SESSIONS_RESPONSE, DEFAULT_HISTORY_LIMIT, } from "../config.js";
import { isDuplicate, debounceHistoryRequest, generateMsgId } from "../dedup.js";
import { getAssistantRuntime } from "../runtime.js";
import { readSessionHistoryWithCron, listSessions } from "../history/index.js";
/**
 * 绑定所有 Socket.IO 事件监听器
 */
export function bindSocketHandlers(socket, deps) {
    const { account, botClientId, log, enqueueMessage, onEvent, reliableEmitter } = deps;
    // ---- 接收用户消息 ----
    socket.on(EVENT_MESSAGE_PRIVATE, (data, ack) => {
        ack?.();
        log?.info(`[${CHANNEL_KEY}] Received private message: ${JSON.stringify(data)}，botClientId:${botClientId}`);
        // 回环防御：过滤自身发出的消息
        if (data.from === botClientId)
            return;
        // 跳过控制消息（typing / stream 信号），只处理真实用户消息
        if (data.kind && data.kind !== "text")
            return;
        // 无内容跳过
        const hasContent = data.content?.trim();
        const hasFiles = data.files && data.files.length > 0;
        if (!hasContent && !hasFiles)
            return;
        // 去重
        if (isDuplicate(data.msgId))
            return;
        // 通知框架收到入站事件（更新 lastEventAt，防止 stale-socket 误判）
        onEvent?.();
        log?.info(`[${CHANNEL_KEY}] Message from ${data.from}: "${(data.content || "").slice(0, 60)}" files=${data.files?.length ?? 0}`);
        enqueueMessage({
            senderId: data.from,
            text: data.content || "",
            messageId: data.msgId,
            files: data.files ?? [],
            timestamp: data.timestamp,
        });
    });
    // ---- 历史消息请求 ----
    socket.on(EVENT_HISTORY_REQUEST, (data, ack) => {
        ack?.();
        if (!data?.from) {
            log?.warn(`[${CHANNEL_KEY}] History request missing userId, ignoring`);
            return;
        }
        // 回环防御：忽略 bot 自身发出的请求
        if (data.from === botClientId)
            return;
        // 去重：如果有 msgId，走消息级去重
        if (data.msgId && isDuplicate(data.msgId)) {
            log?.warn(`[${CHANNEL_KEY}] Duplicate history request (msgId), ignoring`);
            return;
        }
        // 防抖：同一用户高频请求只处理最后一条
        debounceHistoryRequest(data.from, () => {
            // 通知框架收到入站事件（更新 lastEventAt，防止 stale-socket 误判）
            onEvent?.();
            try {
                const pluginRuntime = getAssistantRuntime();
                const currentCfg = pluginRuntime.config.loadConfig();
                const route = pluginRuntime.channel.routing.resolveAgentRoute({
                    cfg: currentCfg,
                    channel: CHANNEL_KEY,
                    accountId: account.accountId,
                    peer: { kind: "direct", id: data.from },
                });
                const sessionKey = route?.sessionKey ?? `${CHANNEL_KEY}:dm:${data.from}`;
                const messages = readSessionHistoryWithCron(sessionKey, {
                    limit: data.limit ?? DEFAULT_HISTORY_LIMIT,
                    chatOnly: data.chatOnly ?? true,
                    includeCron: true,
                });
                log?.info(`[${CHANNEL_KEY}] History request: userId=${data.from} sessionKey=${sessionKey} found=${messages.length}`);
                const historyMsgId = generateMsgId();
                reliableEmitter.emitWithAck(EVENT_HISTORY_RESPONSE, {
                    msgId: historyMsgId,
                    from: botClientId,
                    to: data.from,
                    sessionKey,
                    messages: messages.filter(msg => !!msg.content.trim() || (msg.files && msg.files.length > 0)),
                }, historyMsgId);
            }
            catch (err) {
                log?.error(`[${CHANNEL_KEY}] History request error: ${err}`);
                const errorMsgId = generateMsgId();
                reliableEmitter.emitWithAck(EVENT_HISTORY_RESPONSE, {
                    msgId: errorMsgId,
                    from: botClientId,
                    to: data.from,
                    sessionKey: "",
                    messages: [],
                    error: err instanceof Error ? err.message : String(err),
                }, errorMsgId);
            }
        });
    });
    // ---- 会话列表请求 ----
    socket.on(EVENT_SESSIONS_REQUEST, (data) => {
        // 通知框架收到入站事件（更新 lastEventAt，防止 stale-socket 误判）
        onEvent?.();
        try {
            const sessions = listSessions();
            const sessionsMsgId = generateMsgId();
            reliableEmitter.emitWithAck(EVENT_SESSIONS_RESPONSE, {
                requestId: data.requestId,
                sessions,
                msgId: sessionsMsgId,
            }, sessionsMsgId);
        }
        catch (err) {
            log?.error(`[${CHANNEL_KEY}] Sessions list error: ${err}`);
            const sessionsErrMsgId = generateMsgId();
            reliableEmitter.emitWithAck(EVENT_SESSIONS_RESPONSE, {
                requestId: data.requestId,
                sessions: [],
                error: err instanceof Error ? err.message : String(err),
                msgId: sessionsErrMsgId,
            }, sessionsErrMsgId);
        }
    });
}
//# sourceMappingURL=handlers.js.map