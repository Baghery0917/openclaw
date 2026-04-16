import type { ModuleLog } from './logger.js';
import type { ResolvedYuanbaoAccount } from './types.js';
import type { MessageHandlerContext } from './message-handler/context.js';
import type { WsHeartbeatValue } from './yuanbao-server/ws/index.js';
export type OutboundQueueStrategy = 'immediate' | 'merge-text';
type OutboundQueueItem = {
    type: 'text';
    text: string;
} | {
    type: 'media';
    mediaUrl: string;
    text?: string;
    mediaLocalRoots?: string[];
} | {
    type: 'sticker';
    sticker_id: string;
    text?: string;
};
type SendTextFn = (text: string) => Promise<{
    ok: boolean;
    error?: string;
}>;
export type SendMediaFn = (mediaUrl: string, text?: string, mediaType?: 'image' | 'file' | 'sticker', mediaLocalRoots?: string[]) => Promise<{
    ok: boolean;
    error?: string;
}>;
export type SendStickerFn = (stickerId: string, text?: string) => Promise<{
    ok: boolean;
    error?: string;
}>;
interface OutboundQueueSession {
    readonly strategy: OutboundQueueStrategy;
    readonly msgId: string;
    push(item: OutboundQueueItem): Promise<void>;
    flush(): Promise<boolean>;
    abort(): void;
    emitReplyHeartbeat(heartbeat: WsHeartbeatValue): void;
    drainNow(): Promise<void>;
}
interface RegisterSessionOptions {
    chatType: 'c2c' | 'group';
    account: ResolvedYuanbaoAccount;
    target: string;
    fromAccount?: string;
    refMsgId?: string;
    refFromAccount?: string;
    ctx: MessageHandlerContext;
    msgId: string;
    toAccount?: string;
    mergeOnFlush?: boolean;
}
export interface LightRegisterSessionOptions {
    chatType: 'c2c' | 'group';
    account: ResolvedYuanbaoAccount;
    target: string;
    fromAccount?: string;
    ctx: MessageHandlerContext;
}
interface OutboundQueueManager {
    readonly strategy: OutboundQueueStrategy;
    registerSession(sessionKey: string, options: RegisterSessionOptions): OutboundQueueSession;
    getSession(sessionKey: string): OutboundQueueSession | null;
    getOrCreateSession(sessionKey: string, options: LightRegisterSessionOptions): OutboundQueueSession;
    unregisterSession(sessionKey: string): void;
}
export interface OutboundQueueConfig {
    strategy: OutboundQueueStrategy;
    minChars?: number;
    maxChars?: number;
    chunkText?: (text: string, maxChars: number) => string[];
}
export declare function initOutboundQueue(accountId: string, config: OutboundQueueConfig): OutboundQueueManager;
export declare function getOutboundQueue(accountId: string): OutboundQueueManager | null;
export declare function destroyOutboundQueue(accountId: string): void;
export declare function endsWithTableRow(text: string): boolean;
export declare function hasUnclosedFence(text: string): boolean;
export declare function startsWithBlockElement(text: string): boolean;
export declare function inferBlockSeparator(buffer: string, incoming: string): string;
export type AtomicBlock = {
    start: number;
    end: number;
    kind: 'table' | 'diagram-fence';
};
export declare function extractAtomicBlocks(text: string): AtomicBlock[];
export declare function chunkMarkdownTextAtomicAware(text: string, maxChars: number, chunkFn: (text: string, max: number) => string[]): string[];
export declare function mergeBlockStreamingFences(buffer: string, incoming: string): string;
export interface MergeTextOptions {
    minChars: number;
    maxChars: number;
    chunkText: (text: string, maxChars: number) => string[];
}
declare function createMergeTextSession(callbacks: {
    sendText: SendTextFn;
    sendSticker: SendStickerFn;
    sendMedia: SendMediaFn;
}, msgId: string, sessionKey: string, onComplete: () => void, log: ModuleLog, opts: MergeTextOptions, heartbeatMeta: {
    ctx: MessageHandlerContext;
    account: ResolvedYuanbaoAccount;
    toAccount: string;
    groupCode?: string;
}): OutboundQueueSession;
export { createMergeTextSession as createMergeTextSessionForTest };
