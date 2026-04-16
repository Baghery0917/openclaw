import type { OpenClawConfig, PluginRuntime } from 'openclaw/plugin-sdk';
import type { MarkdownTableMode } from 'openclaw/plugin-sdk/config-runtime';
import type { ResolvedYuanbaoAccount, YuanbaoMsgBodyElement } from '../types.js';
import type { YuanbaoWsClient } from '../yuanbao-server/ws/index.js';
import type { OutboundContentItem } from './handlers/index.js';
import type { MessageHandlerContext } from './context.js';
import type { YuanbaoTraceContext } from '../trace/context.js';
export declare function sendYuanbaoMessageBody(params: {
    account: ResolvedYuanbaoAccount;
    toAccount: string;
    msgBody: YuanbaoMsgBodyElement[];
    fromAccount?: string;
    ctx?: MessageHandlerContext;
}): Promise<{
    ok: boolean;
    messageId?: string;
    error?: string;
}>;
export declare function sendYuanbaoMessage(params: {
    account: ResolvedYuanbaoAccount;
    toAccount: string;
    text: string;
    fromAccount?: string;
    ctx?: MessageHandlerContext;
}): Promise<{
    ok: boolean;
    messageId?: string;
    error?: string;
}>;
export declare function sendYuanbaoGroupMessageBody(params: {
    account: ResolvedYuanbaoAccount;
    groupCode: string;
    msgBody: YuanbaoMsgBodyElement[];
    fromAccount?: string;
    refMsgId?: string;
    refFromAccount?: string;
    ctx?: MessageHandlerContext;
}): Promise<{
    ok: boolean;
    messageId?: string;
    msgSeq?: number;
    error?: string;
}>;
export declare function sendYuanbaoGroupMessage(params: {
    account: ResolvedYuanbaoAccount;
    groupCode: string;
    text: string;
    fromAccount?: string;
    refMsgId?: string;
    refFromAccount?: string;
    ctx?: MessageHandlerContext;
}): Promise<{
    ok: boolean;
    messageId?: string;
    msgSeq?: number;
    error?: string;
}>;
export declare function sendMsgBodyDirect(params: {
    account: ResolvedYuanbaoAccount;
    config: OpenClawConfig;
    target: string;
    msgBody: YuanbaoMsgBodyElement[];
    refMsgId?: string;
    refFromAccount?: string;
    wsClient: YuanbaoWsClient;
    core: PluginRuntime;
    traceContext?: YuanbaoTraceContext;
}): Promise<{
    ok: boolean;
    messageId?: string;
    error?: string;
}>;
export type ReplyTransport = {
    label: string;
    sendText: (params: {
        text: string;
    }) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    sendItems?: (params: {
        items: OutboundContentItem[];
    }) => Promise<{
        ok: boolean;
        error?: string;
    }>;
};
export declare function executeReply(params: {
    transport: ReplyTransport;
    ctx: MessageHandlerContext;
    account: ResolvedYuanbaoAccount;
    core: PluginRuntime;
    config: OpenClawConfig;
    ctxPayload: Record<string, unknown>;
    replyRuntime: {
        config: OpenClawConfig;
        disableBlockStreaming: boolean;
    };
    tableMode: MarkdownTableMode;
    splitFinalText: (text: string) => string[];
    overflowPolicy: ResolvedYuanbaoAccount['overflowPolicy'];
    sessionKey?: string;
    mediaLocalRoots?: string[];
    groupCode?: string;
    appendText?: string;
}): Promise<void>;
