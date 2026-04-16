import protobuf from 'protobufjs';
import jsonDescriptor from './proto/conn.json' with { type: 'json' };
import { createLog } from '../../logger.js';
let root = null;
function getRoot() {
    if (!root) {
        root = protobuf.Root.fromJSON(jsonDescriptor);
    }
    return root;
}
export function encodePB(key, value) {
    try {
        const type = getRoot().lookupType(key);
        const message = type.create(value);
        return type.encode(message).finish();
    }
    catch (error) {
        createLog('conn-codec').error(`编码失败: key=${key}, error=${error.message}`);
        return null;
    }
}
export function decodePB(key, data) {
    try {
        const type = getRoot().lookupType(key);
        return type.decode(data instanceof Uint8Array ? data : new Uint8Array(data));
    }
    catch {
        return null;
    }
}
export const PB_MSG_TYPES = {
    ConnMsg: 'trpc.yuanbao.conn_common.ConnMsg',
    AuthBindReq: 'trpc.yuanbao.conn_common.AuthBindReq',
    AuthBindRsp: 'trpc.yuanbao.conn_common.AuthBindRsp',
    PingReq: 'trpc.yuanbao.conn_common.PingReq',
    PingRsp: 'trpc.yuanbao.conn_common.PingRsp',
    KickoutMsg: 'trpc.yuanbao.conn_common.KickoutMsg',
    DirectedPush: 'trpc.yuanbao.conn_common.DirectedPush',
    PushMsg: 'trpc.yuanbao.conn_common.PushMsg',
};
export const CMD_TYPE = {
    Request: 0,
    Response: 1,
    Push: 2,
    PushAck: 3,
};
export const CMD = {
    AuthBind: 'auth-bind',
    Ping: 'ping',
    Kickout: 'kickout',
    UpdateMeta: 'update-meta',
};
export const MODULE = {
    ConnAccess: 'conn_access',
};
let seqCounter = 0;
const SEQ_NO_OVERFLOW_RESET = Number.MAX_SAFE_INTEGER;
export function nextSeqNo() {
    const next = seqCounter++;
    if (next >= SEQ_NO_OVERFLOW_RESET) {
        return 0;
    }
    return next;
}
export function createHead(cmd, module, msgId) {
    return {
        cmdType: CMD_TYPE.Request,
        cmd,
        seqNo: nextSeqNo(),
        msgId,
        module,
    };
}
export function encodeConnMsg(head, innerData) {
    return encodePB(PB_MSG_TYPES.ConnMsg, {
        head,
        data: innerData ?? new Uint8Array(0),
    });
}
export function decodeConnMsg(raw) {
    return decodePB(PB_MSG_TYPES.ConnMsg, raw);
}
const OPENCLAW_ID = 16;
export function buildAuthBindMsg(params) {
    const authBindPayload = {
        bizId: params.bizId,
        authInfo: {
            uid: params.uid,
            source: params.source,
            token: params.token,
        },
        deviceInfo: {
            appVersion: params.appVersion,
            appOperationSystem: params.operationSystem,
            botVersion: params.botVersion,
            instanceId: String(OPENCLAW_ID),
        },
    };
    if (params.routeEnv) {
        authBindPayload.envName = params.routeEnv;
    }
    const authBindData = encodePB(PB_MSG_TYPES.AuthBindReq, authBindPayload);
    if (!authBindData)
        return null;
    const head = createHead(CMD.AuthBind, MODULE.ConnAccess, params.msgId);
    return encodeConnMsg(head, authBindData);
}
export function buildPingMsg(msgId) {
    const pingData = encodePB(PB_MSG_TYPES.PingReq, {});
    if (!pingData)
        return null;
    const head = createHead(CMD.Ping, MODULE.ConnAccess, msgId);
    return encodeConnMsg(head, pingData);
}
export function buildPushAck(originalHead) {
    const ackHead = {
        ...originalHead,
        cmdType: CMD_TYPE.PushAck,
        seqNo: nextSeqNo(),
    };
    return encodeConnMsg(ackHead, null);
}
export function buildBusinessConnMsg(cmd, module, bizData, msgId) {
    const head = createHead(cmd, module, msgId);
    return encodeConnMsg(head, bizData);
}
