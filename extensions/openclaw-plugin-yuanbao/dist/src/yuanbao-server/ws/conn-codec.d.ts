export declare function encodePB(key: string, value: Record<string, unknown>): Uint8Array | null;
export declare function decodePB(key: string, data: Uint8Array | ArrayBuffer): any;
export declare const PB_MSG_TYPES: {
    readonly ConnMsg: "trpc.yuanbao.conn_common.ConnMsg";
    readonly AuthBindReq: "trpc.yuanbao.conn_common.AuthBindReq";
    readonly AuthBindRsp: "trpc.yuanbao.conn_common.AuthBindRsp";
    readonly PingReq: "trpc.yuanbao.conn_common.PingReq";
    readonly PingRsp: "trpc.yuanbao.conn_common.PingRsp";
    readonly KickoutMsg: "trpc.yuanbao.conn_common.KickoutMsg";
    readonly DirectedPush: "trpc.yuanbao.conn_common.DirectedPush";
    readonly PushMsg: "trpc.yuanbao.conn_common.PushMsg";
};
export declare const CMD_TYPE: {
    readonly Request: 0;
    readonly Response: 1;
    readonly Push: 2;
    readonly PushAck: 3;
};
export declare const CMD: {
    readonly AuthBind: "auth-bind";
    readonly Ping: "ping";
    readonly Kickout: "kickout";
    readonly UpdateMeta: "update-meta";
};
export declare const MODULE: {
    readonly ConnAccess: "conn_access";
};
export type PBHead = {
    cmdType: number;
    cmd: string;
    seqNo: number;
    msgId: string;
    module: string;
    needAck?: boolean;
    status?: number;
};
export type PBConnMsg = {
    head: PBHead;
    data: Uint8Array;
};
export declare function nextSeqNo(): number;
export declare function createHead(cmd: string, module: string, msgId: string): PBHead;
export declare function encodeConnMsg(head: PBHead, innerData: Uint8Array | null): Uint8Array | null;
export declare function decodeConnMsg(raw: Uint8Array | ArrayBuffer): PBConnMsg | null;
interface AuthBindParams {
    bizId: string;
    uid: string;
    source: string;
    token: string;
    msgId: string;
    routeEnv?: string;
    appVersion: string;
    operationSystem: string;
    botVersion: string;
}
export declare function buildAuthBindMsg(params: AuthBindParams): Uint8Array | null;
export declare function buildPingMsg(msgId: string): Uint8Array | null;
export declare function buildPushAck(originalHead: PBHead): Uint8Array | null;
export declare function buildBusinessConnMsg(cmd: string, module: string, bizData: Uint8Array, msgId: string): Uint8Array | null;
export {};
