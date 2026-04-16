import type { OpenClawConfig, PluginRuntime } from 'openclaw/plugin-sdk';
import type { ResolvedYuanbaoAccount } from '../types.js';
import type { YuanbaoWsClient } from '../yuanbao-server/ws/index.js';
import type { YuanbaoTraceContext } from '../trace/context.js';
export type MessageHandlerContext = {
    groupCode?: string;
    account: ResolvedYuanbaoAccount;
    config: OpenClawConfig;
    core: PluginRuntime;
    log: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
        verbose: (msg: string) => void;
    };
    statusSink?: (patch: {
        lastInboundAt?: number;
        lastOutboundAt?: number;
    }) => void;
    wsClient: YuanbaoWsClient;
    traceContext?: YuanbaoTraceContext;
    abortSignal?: AbortSignal;
};
export declare const YUANBAO_FINAL_TEXT_CHUNK_LIMIT = 3000;
export declare const YUANBAO_OVERFLOW_NOTICE_TEXT = "\u5185\u5BB9\u8F83\u957F\uFF0C\u5DF2\u505C\u6B62\u53D1\u9001\u5269\u4F59\u5185\u5BB9\u3002";
export declare const YUANBAO_MARKDOWN_HINT = "\u26A0\uFE0F \u683C\u5F0F\u89C4\u8303\uFF08\u5F3A\u5236\uFF09\uFF1A\u5F53\u56DE\u590D\u5185\u5BB9\u5305\u542B Markdown \u8868\u683C\u65F6\uFF0C\u7981\u6B62\u7528 ```markdown \u4EE3\u7801\u5757\u5305\u88F9\uFF0C\u76F4\u63A5\u8F93\u51FA\u8868\u683C\u5185\u5BB9\u5373\u53EF\uFF0C\u4E0D\u9700\u8981\u5916\u5C42 fence\u3002";
export declare function stripOuterMarkdownFence(text: string): string;
export declare const REPLY_TIMEOUT_MS: number;
export declare function resolveOutboundSenderAccount(account: ResolvedYuanbaoAccount): string | undefined;
export declare function rewriteSlashCommand(text: string, onRewrite?: (original: string, rewritten: string) => void): string;
