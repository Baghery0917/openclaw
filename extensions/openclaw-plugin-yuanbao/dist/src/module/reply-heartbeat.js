import { createLog } from '../logger.js';
import { WS_HEARTBEAT } from '../yuanbao-server/ws/index.js';
const HEARTBEAT_TIMEOUT_MS = 800;
const DEFAULT_RUNNING_HEARTBEAT_INTERVAL_MS = 2000;
const MAX_RUNNING_HEARTBEAT_IDLE_MS = 30000;
const log = createLog('reply-heartbeat');
export async function emitReplyHeartbeat(params) {
    const { ctx, account, toAccount, groupCode, heartbeat, sendTime } = params;
    const fromAccount = account.botId?.trim() ?? '';
    const targetAccount = toAccount.trim();
    const withTimeout = async (promise, timeoutMs) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`heartbeat timeout(${timeoutMs}ms)`)), timeoutMs);
        promise
            .then((value) => {
            clearTimeout(timer);
            resolve(value);
        })
            .catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
    if (!ctx.wsClient) {
        log.warn(`[${account.accountId}] 心跳发送失败: wsClient 不可用`);
        return;
    }
    if (!fromAccount || !targetAccount) {
        log.warn(`[${account.accountId}] 心跳发送失败: from/to 账号缺失`, {
            fromAccount,
            toAccount: targetAccount,
            groupCode,
            heartbeat,
        });
        return;
    }
    try {
        if (groupCode) {
            const rsp = await withTimeout(ctx.wsClient.sendGroupHeartbeat({
                from_account: fromAccount,
                to_account: targetAccount,
                group_code: groupCode,
                send_time: sendTime,
                heartbeat,
            }), HEARTBEAT_TIMEOUT_MS);
            if (rsp.code !== 0) {
                log.warn(`[${account.accountId}] 发送群聊回复状态心跳失败: code=${rsp.code}, msg=${rsp.msg ?? rsp.message ?? ''}`);
            }
            return;
        }
        const rsp = await withTimeout(ctx.wsClient.sendPrivateHeartbeat({
            from_account: fromAccount,
            to_account: targetAccount,
            heartbeat,
        }), HEARTBEAT_TIMEOUT_MS);
        if (rsp.code !== 0) {
            log.warn(`[${account.accountId}] 发送私聊回复状态心跳失败: code=${rsp.code}, msg=${rsp.msg ?? rsp.message ?? ''}`);
        }
    }
    catch (err) {
        log.warn(`[${account.accountId}] 发送回复状态心跳异常: ${String(err)}`);
    }
}
export function createReplyHeartbeatController(params) {
    const { meta } = params;
    const runningIntervalMs = params.runningIntervalMs ?? DEFAULT_RUNNING_HEARTBEAT_INTERVAL_MS;
    let runningHeartbeatTimer = null;
    let runningHeartbeatActive = false;
    let runningHeartbeatStartTime = null;
    let lastRunningEmitAt = null;
    const send = (heartbeat, sendTime) => {
        void emitReplyHeartbeat({
            ...meta,
            heartbeat,
            sendTime,
        });
    };
    const sendRunningHeartbeatAndSchedule = async () => {
        if (!runningHeartbeatActive)
            return;
        if (runningHeartbeatStartTime === null)
            return;
        if (lastRunningEmitAt === null)
            return;
        if ((Date.now() - lastRunningEmitAt) > MAX_RUNNING_HEARTBEAT_IDLE_MS) {
            stop();
            return;
        }
        await emitReplyHeartbeat({
            ...meta,
            heartbeat: WS_HEARTBEAT.RUNNING,
            sendTime: runningHeartbeatStartTime,
        });
        if (!runningHeartbeatActive)
            return;
        runningHeartbeatTimer = setTimeout(() => {
            void sendRunningHeartbeatAndSchedule();
        }, runningIntervalMs);
    };
    const stop = () => {
        runningHeartbeatActive = false;
        runningHeartbeatStartTime = null;
        lastRunningEmitAt = null;
        if (runningHeartbeatTimer) {
            clearTimeout(runningHeartbeatTimer);
            runningHeartbeatTimer = null;
        }
    };
    const startRunning = () => {
        if (runningHeartbeatActive)
            return;
        runningHeartbeatActive = true;
        runningHeartbeatStartTime = Date.now();
        lastRunningEmitAt = Date.now();
        void sendRunningHeartbeatAndSchedule();
    };
    const emit = (heartbeat) => {
        if (heartbeat === WS_HEARTBEAT.RUNNING) {
            if (runningHeartbeatActive) {
                lastRunningEmitAt = Date.now();
                return;
            }
            startRunning();
            return;
        }
        stop();
        send(heartbeat, Date.now());
    };
    return {
        emit,
        onReplySent: stop,
        stop,
    };
}
