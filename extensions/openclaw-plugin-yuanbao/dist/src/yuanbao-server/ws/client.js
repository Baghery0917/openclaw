import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { getPluginVersion, getOpenclawVersion, getOperationSystem } from '../../utils/get-env.js';
import { decodeConnMsg, decodePB, buildAuthBindMsg, buildPingMsg, buildPushAck, buildBusinessConnMsg, PB_MSG_TYPES, CMD_TYPE, CMD, } from './conn-codec.js';
import { encodeSendC2CMessageReq, encodeSendGroupMessageReq, decodeSendMessageRsp, encodeSendPrivateHeartbeatReq, encodeSendGroupHeartbeatReq, decodeSendPrivateHeartbeatRsp, decodeSendGroupHeartbeatRsp, encodeQueryGroupInfoReq, decodeQueryGroupInfoRsp, encodeGetGroupMemberListReq, decodeGetGroupMemberListRsp, } from './biz-codec.js';
import { createLog } from '../../logger.js';
import { msgBodyDesensitization } from '../../utils.js';
const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];
const NO_RECONNECT_CLOSE_CODES = new Set([
    4012,
    4013,
    4014,
    4018,
    4019,
    4021,
]);
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 100;
const DEFAULT_SEND_TIMEOUT_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_S = 5;
const AUTH_FAILED_CODES = new Set([41103, 41104, 41108]);
const AUTH_ALREADY_CODE = 41101;
const AUTH_RETRYABLE_CODES = new Set([
    50400,
    50503,
    90001,
    90003,
]);
const HEARTBEAT_TIMEOUT_THRESHOLD = 2;
function generateMsgId() {
    return uuidv4().replace(/-/g, '');
}
export const BIZ_CMD = {
    SendC2CMessage: 'send_c2c_message',
    SendGroupMessage: 'send_group_message',
    QueryGroupInfo: 'query_group_info',
    GetGroupMemberList: 'get_group_member_list',
    SendPrivateHeartbeat: 'send_private_heartbeat',
    SendGroupHeartbeat: 'send_group_heartbeat',
};
const BIZ_MODULE = 'yuanbao_openclaw_proxy';
export class YuanbaoWsClient {
    connectionConfig;
    clientConfig;
    callbacks;
    log;
    ws = null;
    state = 'disconnected';
    connectId = null;
    heartbeatIntervalS = DEFAULT_HEARTBEAT_INTERVAL_S;
    heartbeatTimer = null;
    heartbeatAckReceived = true;
    lastHeartbeatAt = 0;
    heartbeatTimeoutCount = 0;
    reconnectAttempts = 0;
    reconnectTimer = null;
    abortController = null;
    disposed = false;
    pendingRequests = new Map();
    constructor(params) {
        this.log = createLog('ws', params.log);
        this.log.info('初始化 WebSocket 客户端', { connection: params.connection, config: params.config });
        this.connectionConfig = params.connection;
        this.clientConfig = {
            maxReconnectAttempts: params.config?.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
            reconnectDelays: params.config?.reconnectDelays ?? DEFAULT_RECONNECT_DELAYS,
        };
        this.callbacks = params.callbacks ?? {};
    }
    updateAuth(auth) {
        this.connectionConfig = {
            ...this.connectionConfig,
            auth,
        };
    }
    connect() {
        if (this.disposed) {
            throw new Error('Client has been disposed');
        }
        this.abortController = new AbortController();
        this.doConnect();
    }
    disconnect() {
        this.disposed = true;
        this.cleanup();
    }
    getState() {
        return this.state;
    }
    getConnectId() {
        return this.connectId;
    }
    sendBinary(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.log.error(`发送失败: 连接不可用 (state=${this.state}, readyState=${this.ws?.readyState ?? 'no socket'})`);
            return false;
        }
        this.ws.send(data);
        return true;
    }
    sendAndWait(cmd, module, data, timeoutMs = DEFAULT_SEND_TIMEOUT_MS) {
        const msgId = generateMsgId();
        const binary = buildBusinessConnMsg(cmd, module, data, msgId);
        if (!binary) {
            return Promise.reject(new Error('Failed to encode business message'));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(msgId);
                reject(new Error(`WS request timeout (${timeoutMs}ms) for msgId=${msgId}`));
            }, timeoutMs);
            this.pendingRequests.set(msgId, { resolve, timer });
            const sent = this.sendBinary(binary);
            if (!sent) {
                clearTimeout(timer);
                this.pendingRequests.delete(msgId);
                reject(new Error('WebSocket not connected, cannot send'));
            }
        });
    }
    sendC2CMessage(data) {
        this.log.debug('[私聊] 准备发送消息', { to_account: data.to_account, body: msgBodyDesensitization(data.msg_body) });
        const encoded = encodeSendC2CMessageReq(data);
        if (!encoded)
            return Promise.reject(new Error('Failed to encode SendC2CMessageReq'));
        return this.sendAndWait(BIZ_CMD.SendC2CMessage, BIZ_MODULE, encoded);
    }
    sendGroupMessage(data) {
        this.log.debug('[群聊] 准备发送消息', { msg_id: data.msg_id, group_code: data.group_code, body: msgBodyDesensitization(data.msg_body) });
        const encoded = encodeSendGroupMessageReq(data);
        if (!encoded)
            return Promise.reject(new Error('Failed to encode SendGroupMessageReq'));
        return this.sendAndWait(BIZ_CMD.SendGroupMessage, BIZ_MODULE, encoded);
    }
    sendAndWaitWith(cmd, module, data, decoder, timeoutMs = DEFAULT_SEND_TIMEOUT_MS) {
        const msgId = generateMsgId();
        const binary = buildBusinessConnMsg(cmd, module, data, msgId);
        if (!binary) {
            return Promise.reject(new Error('Failed to encode business message'));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(msgId);
                reject(new Error(`WS request timeout (${timeoutMs}ms) for msgId=${msgId}`));
            }, timeoutMs);
            this.pendingRequests.set(msgId, { resolve, timer, decoder: decoder });
            const sent = this.sendBinary(binary);
            if (!sent) {
                clearTimeout(timer);
                this.pendingRequests.delete(msgId);
                reject(new Error('WebSocket not connected, cannot send'));
            }
        });
    }
    queryGroupInfo(data) {
        this.log.debug('[群信息] 查询群信息', { group_code: data.group_code });
        const encoded = encodeQueryGroupInfoReq(data);
        if (!encoded)
            return Promise.reject(new Error('Failed to encode QueryGroupInfoReq'));
        return this.sendAndWaitWith(BIZ_CMD.QueryGroupInfo, BIZ_MODULE, encoded, decodeQueryGroupInfoRsp);
    }
    getGroupMemberList(data) {
        this.log.debug('[群成员] 获取群成员列表', { group_code: data.group_code });
        const encoded = encodeGetGroupMemberListReq(data);
        if (!encoded)
            return Promise.reject(new Error('Failed to encode GetGroupMemberListReq'));
        return this.sendAndWaitWith(BIZ_CMD.GetGroupMemberList, BIZ_MODULE, encoded, decodeGetGroupMemberListRsp);
    }
    sendPrivateHeartbeat(data) {
        this.log.debug('[私聊] 发送回复状态心跳', { from_account: data.from_account, to_account: data.to_account, heartbeat: data.heartbeat });
        const encoded = encodeSendPrivateHeartbeatReq(data);
        if (!encoded)
            return Promise.reject(new Error('Failed to encode SendPrivateHeartbeatReq'));
        return this.sendAndWaitWith(BIZ_CMD.SendPrivateHeartbeat, BIZ_MODULE, encoded, decodeSendPrivateHeartbeatRsp);
    }
    sendGroupHeartbeat(data) {
        this.log.debug('[群聊] 发送回复状态心跳', {
            from_account: data.from_account,
            to_account: data.to_account,
            group_code: data.group_code,
            send_time: data.send_time,
            heartbeat: data.heartbeat,
        });
        const encoded = encodeSendGroupHeartbeatReq(data);
        if (!encoded)
            return Promise.reject(new Error('Failed to encode SendGroupHeartbeatReq'));
        return this.sendAndWaitWith(BIZ_CMD.SendGroupHeartbeat, BIZ_MODULE, encoded, decodeSendGroupHeartbeatRsp);
    }
    doConnect() {
        if (this.disposed)
            return;
        this.setState('connecting');
        this.log.info(`正在连接 ${this.connectionConfig.gatewayUrl}`);
        try {
            const ws = new WebSocket(this.connectionConfig.gatewayUrl);
            this.ws = ws;
            ws.on('open', () => {
                this.log.info('WebSocket 连接已建立，发送鉴权...');
                this.sendAuthBind();
            });
            ws.on('message', (raw) => {
                this.onMessage(raw);
            });
            ws.on('close', (code, reason) => {
                const reasonStr = reason.toString('utf-8');
                this.log.info(`连接关闭: code=${code}, reason=${reasonStr}`);
                this.stopHeartbeat();
                this.callbacks.onClose?.(code, reasonStr);
                if (!this.disposed) {
                    if (NO_RECONNECT_CLOSE_CODES.has(code)) {
                        this.log.info(`收到不可重连的 close code=${code}，放弃重连`);
                        this.setState('disconnected');
                        this.callbacks.onError?.(new Error(`Connection closed with non-retryable code=${code}: ${reasonStr}`));
                    }
                    else {
                        this.scheduleReconnect();
                    }
                }
            });
            ws.on('error', (err) => {
                this.log.error(`连接错误: ${err.message}`);
                this.callbacks.onError?.(err);
            });
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.log.error(`建立连接失败: ${error.message}`);
            this.callbacks.onError?.(error);
            if (!this.disposed) {
                this.scheduleReconnect();
            }
        }
    }
    onMessage(raw) {
        let binary;
        if (raw instanceof Buffer) {
            binary = new Uint8Array(raw);
        }
        else if (raw instanceof ArrayBuffer) {
            binary = new Uint8Array(raw);
        }
        else if (Array.isArray(raw)) {
            binary = new Uint8Array(Buffer.concat(raw));
        }
        else {
            this.log.warn('收到非二进制消息，忽略');
            return;
        }
        const connMsg = decodeConnMsg(binary);
        if (!connMsg?.head) {
            this.log.warn('收到无法解码的 ConnMsg');
            return;
        }
        this.handleConnMsg(connMsg);
    }
    handleConnMsg(connMsg) {
        const { head } = connMsg;
        const { cmdType } = head;
        if (cmdType === CMD_TYPE.Response) {
            this.onResponse(connMsg);
            return;
        }
        if (cmdType === CMD_TYPE.Push) {
            this.onPush(connMsg);
            return;
        }
        this.log.debug(`收到未处理的 cmdType=${cmdType}, cmd=${head.cmd}`);
    }
    onResponse(connMsg) {
        const { head, data } = connMsg;
        const { cmd } = head;
        if (cmd === CMD.AuthBind) {
            this.onAuthBindResponse(head, data);
            return;
        }
        if (cmd === CMD.Ping) {
            this.onPingResponse(head, data);
            return;
        }
        this.onBusinessResponse(head, data);
    }
    sendAuthBind() {
        this.setState('authenticating');
        const { auth } = this.connectionConfig;
        const msgId = generateMsgId();
        const payload = {
            bizId: auth.bizId,
            uid: auth.uid,
            source: auth.source,
            token: auth.token,
            msgId,
            routeEnv: auth.routeEnv,
            appVersion: getPluginVersion(),
            operationSystem: getOperationSystem(),
            botVersion: getOpenclawVersion(),
        };
        const binary = buildAuthBindMsg(payload);
        if (!binary) {
            this.log.error('鉴权消息编码失败');
            this.callbacks.onError?.(new Error('Failed to encode auth-bind message'));
            return;
        }
        this.log.info('发送鉴权请求...');
        this.sendBinary(binary);
    }
    tryAuthFailedRefresh(errorCode, source) {
        if (!AUTH_FAILED_CODES.has(errorCode) || !this.callbacks.onAuthFailed) {
            return false;
        }
        this.log.warn(`[${source}] token 无效(code=${errorCode})，刷新 token 后走 scheduleReconnect 重连`);
        this.closeCurrentWs();
        this.callbacks.onAuthFailed(errorCode).then((newAuth) => {
            if (newAuth && !this.disposed) {
                this.log.info(`[${source}] token 刷新成功，使用新 token 通过 scheduleReconnect 重连`);
                this.updateAuth(newAuth);
                this.scheduleReconnect();
            }
            else {
                this.log.warn(`[${source}] token 刷新返回空或客户端已销毁，放弃重连`);
                this.setState('disconnected');
            }
        })
            .catch((err) => {
            this.log.error(`[${source}] token 刷新失败: ${String(err)}，延迟后重试签票`);
            if (!this.disposed) {
                this.retryAuthRefreshAfterDelay(errorCode, source);
            }
            else {
                this.setState('disconnected');
            }
        });
        return true;
    }
    retryAuthRefreshAfterDelay(errorCode, source) {
        if (this.disposed)
            return;
        if (this.reconnectAttempts >= this.clientConfig.maxReconnectAttempts) {
            this.log.error(`[${source}] 已达最大重连次数 (${this.clientConfig.maxReconnectAttempts})，放弃签票重试`);
            this.setState('disconnected');
            this.callbacks.onError?.(new Error(`Max reconnect attempts (${this.clientConfig.maxReconnectAttempts}) exceeded during token refresh`));
            return;
        }
        const delay = this.getReconnectDelay();
        this.reconnectAttempts++;
        this.setState('reconnecting');
        this.log.info(`[${source}] 将在 ${delay}ms 后重试签票 (第 ${this.reconnectAttempts}/${this.clientConfig.maxReconnectAttempts} 次)`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.disposed || !this.callbacks.onAuthFailed)
                return;
            this.callbacks.onAuthFailed(errorCode).then((newAuth) => {
                if (newAuth && !this.disposed) {
                    this.log.info(`[${source}] 签票重试成功，使用新 token 通过 scheduleReconnect 重连`);
                    this.updateAuth(newAuth);
                    this.scheduleReconnect();
                }
                else {
                    this.log.warn(`[${source}] 签票重试返回空或客户端已销毁，放弃重连`);
                    this.setState('disconnected');
                }
            })
                .catch((err) => {
                this.log.error(`[${source}] 签票重试仍失败: ${String(err)}，继续延迟重试`);
                if (!this.disposed) {
                    this.retryAuthRefreshAfterDelay(errorCode, source);
                }
                else {
                    this.setState('disconnected');
                }
            });
        }, delay);
    }
    onAuthBindResponse(head, data) {
        const rsp = decodePB(PB_MSG_TYPES.AuthBindRsp, data);
        if (head.status && head.status !== 0) {
            this.log.error(`鉴权回包 head.status 非零: status=${head.status}, rsp.code=${rsp?.code}, rsp.message=${rsp?.message}`);
            if (rsp?.code === AUTH_ALREADY_CODE) {
                this.log.info(`收到 ALREADY_AUTH(${AUTH_ALREADY_CODE})，视为鉴权成功`);
            }
            else {
                if (rsp?.code && this.tryAuthFailedRefresh(rsp.code, 'auth-head-status'))
                    return;
                if (rsp?.code && AUTH_RETRYABLE_CODES.has(rsp.code)) {
                    this.log.warn?.(`鉴权收到可重试错误(code=${rsp.code})，走 scheduleReconnect 重连`);
                    this.closeCurrentWs();
                    this.scheduleReconnect();
                    return;
                }
                this.closeCurrentWs();
                this.setState('disconnected');
                this.callbacks.onError?.(new Error(`Auth-bind failed: status=${head.status}`));
                return;
            }
        }
        if (!rsp || (rsp.code !== 0 && rsp.code !== AUTH_ALREADY_CODE)) {
            this.log.error(`鉴权回包业务异常: rsp.code=${rsp?.code}, rsp.message=${rsp?.message}`);
            if (rsp?.code && this.tryAuthFailedRefresh(rsp.code, 'auth-rsp-code'))
                return;
            if (rsp?.code && AUTH_RETRYABLE_CODES.has(rsp.code)) {
                this.log.warn?.(`鉴权收到可重试错误(code=${rsp.code})，走 scheduleReconnect 重连`);
                this.closeCurrentWs();
                this.scheduleReconnect();
                return;
            }
            this.closeCurrentWs();
            this.setState('disconnected');
            this.callbacks.onError?.(new Error(`Auth-bind response error: code=${rsp?.code}`));
            return;
        }
        this.connectId = rsp.connectId || null;
        this.log.info(`鉴权成功: connectId=${this.connectId}`);
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.startHeartbeat(true);
        this.callbacks.onReady?.({
            connectId: rsp.connectId || '',
            timestamp: Number(rsp.timestamp || 0),
            clientIp: rsp.clientIp || '',
        });
    }
    startHeartbeat(isFirst = false) {
        this.stopHeartbeat();
        this.heartbeatAckReceived = true;
        if (isFirst) {
            this.heartbeatTimeoutCount = 0;
        }
        const delayMs = isFirst ? 5_000 : (this.heartbeatIntervalS - 1) * 1000;
        this.log.debug(`心跳定时: ${delayMs}ms 后发送`);
        this.heartbeatTimer = setTimeout(() => {
            this.sendPing();
        }, delayMs);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    scheduleNextPingCheck() {
        this.stopHeartbeat();
        const delayMs = (this.heartbeatIntervalS - 1) * 1000;
        this.heartbeatTimer = setTimeout(() => {
            this.heartbeatTimer = null;
            this.sendPing();
        }, delayMs);
    }
    sendPing() {
        if (!this.heartbeatAckReceived) {
            this.heartbeatTimeoutCount++;
            const elapsed = Date.now() - this.lastHeartbeatAt;
            if (this.heartbeatTimeoutCount >= HEARTBEAT_TIMEOUT_THRESHOLD) {
                this.log.warn(`心跳连续 ${this.heartbeatTimeoutCount} 次超时 (${elapsed}ms 未收到回包)，触发重连`);
                this.heartbeatTimeoutCount = 0;
                this.closeCurrentWs();
                this.scheduleReconnect();
                return;
            }
            this.log.warn(`心跳超时 (${elapsed}ms 未收到回包)，第 ${this.heartbeatTimeoutCount}/${HEARTBEAT_TIMEOUT_THRESHOLD} 次，${HEARTBEAT_TIMEOUT_THRESHOLD - this.heartbeatTimeoutCount} 次后再判定重连`);
            this.scheduleNextPingCheck();
            return;
        }
        const msgId = generateMsgId();
        const binary = buildPingMsg(msgId);
        if (!binary) {
            this.log.error('心跳消息编码失败');
            return;
        }
        this.heartbeatAckReceived = false;
        this.lastHeartbeatAt = Date.now();
        this.sendBinary(binary);
        this.log.debug('心跳已发送');
    }
    onPingResponse(head, data) {
        this.heartbeatAckReceived = true;
        this.heartbeatTimeoutCount = 0;
        const latency = Date.now() - this.lastHeartbeatAt;
        const rsp = decodePB(PB_MSG_TYPES.PingRsp, data);
        if (rsp?.heartInterval && rsp.heartInterval > 1) {
            this.heartbeatIntervalS = rsp.heartInterval;
            this.log.debug(`心跳 ACK: latency=${latency}ms, next interval=${rsp.heartInterval}s`);
        }
        else {
            this.log.debug(`心跳 ACK: latency=${latency}ms`);
        }
        this.startHeartbeat(false);
    }
    onPush(connMsg) {
        const { head, data } = connMsg;
        this.log.debug(`收到推送: head=${JSON.stringify(head)}`);
        if (head.needAck) {
            const ack = buildPushAck(head);
            if (ack) {
                this.sendBinary(ack);
                this.log.debug(`ACK 已发送: cmd=${head.cmd}, msgId=${head.msgId}`);
            }
        }
        if (head.cmd === CMD.Kickout) {
            const kickout = decodePB(PB_MSG_TYPES.KickoutMsg, data);
            this.log.warn(`被踢下线: ${JSON.stringify(kickout)}`);
            this.callbacks.onKickout?.({
                status: kickout?.status || 0,
                reason: kickout?.reason || '',
                otherDeviceName: kickout?.otherDeviceName,
            });
            return;
        }
        const pushMsg = decodePB(PB_MSG_TYPES.PushMsg, data);
        if (pushMsg && (pushMsg.cmd || pushMsg.module)) {
            const rawData = pushMsg.data;
            const pushEvent = {
                cmd: pushMsg.cmd || head.cmd,
                module: pushMsg.module || head.module,
                msgId: pushMsg.msgId || head.msgId,
                rawData,
                connData: data,
            };
            this.callbacks.onDispatch?.(pushEvent);
            return;
        }
        const directed = decodePB(PB_MSG_TYPES.DirectedPush, data);
        if (directed && (directed.type || directed.content)) {
            const pushEvent = {
                type: directed.type,
                content: directed.content,
                cmd: head.cmd,
                module: head.module,
                msgId: head.msgId,
            };
            this.callbacks.onDispatch?.(pushEvent);
            return;
        }
        this.callbacks.onDispatch?.({
            cmd: head.cmd,
            module: head.module,
            msgId: head.msgId,
            rawData: data,
        });
    }
    onBusinessResponse(head, data) {
        const { msgId } = head;
        if (!msgId)
            return;
        const pending = this.pendingRequests.get(msgId);
        if (!pending) {
            this.log.debug(`收到无匹配的业务回包: cmd=${head.cmd}, msgId=${msgId}`);
            return;
        }
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msgId);
        if (data && data.length > 0) {
            const decoder = pending.decoder ?? decodeSendMessageRsp;
            const rsp = decoder(data, msgId);
            this.log.debug(`业务回包解码: ${JSON.stringify(rsp)}`);
            if (rsp) {
                if (head.status && head.status !== 0) {
                    rsp.code = head.status;
                    if ('message' in rsp)
                        rsp.message = rsp.message || 'FAIL';
                    if ('msg' in rsp)
                        rsp.msg = rsp.msg || 'FAIL';
                }
                pending.resolve(rsp);
                return;
            }
        }
        pending.resolve({
            msgId,
            code: head.status || 0,
            message: head.status === 0 ? '' : 'FAIL',
        });
    }
    getReconnectDelay() {
        const delays = this.clientConfig.reconnectDelays;
        const index = Math.min(this.reconnectAttempts, delays.length - 1);
        return delays[index];
    }
    scheduleReconnect(customDelay) {
        if (this.disposed)
            return;
        if (this.reconnectAttempts >= this.clientConfig.maxReconnectAttempts) {
            this.log.error(`已达最大重连次数 (${this.clientConfig.maxReconnectAttempts})，放弃重连`);
            this.setState('disconnected');
            this.callbacks.onError?.(new Error(`Max reconnect attempts (${this.clientConfig.maxReconnectAttempts}) exceeded`));
            return;
        }
        const delay = customDelay ?? this.getReconnectDelay();
        this.reconnectAttempts++;
        this.setState('reconnecting');
        this.log.info(`将在 ${delay}ms 后重连 (第 ${this.reconnectAttempts}/${this.clientConfig.maxReconnectAttempts} 次)`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.disposed) {
                this.doConnect();
            }
        }, delay);
    }
    setState(next) {
        if (this.state === next)
            return;
        this.state = next;
        this.callbacks.onStateChange?.(next);
    }
    closeCurrentWs() {
        this.stopHeartbeat();
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                this.ws.on('error', () => { });
                if (this.ws.readyState === WebSocket.OPEN
                    || this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.close(1000, 'client closing');
                }
            }
            catch {
            }
            this.ws = null;
        }
    }
    cleanup() {
        this.closeCurrentWs();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        for (const [msgId, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.resolve({
                msgId,
                code: -1,
                message: 'Client disconnected',
            });
        }
        this.pendingRequests.clear();
        this.setState('disconnected');
    }
}
