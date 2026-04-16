import { OpenClawConfig, PluginRuntime } from 'openclaw/plugin-sdk';
import type { YuanbaoWsClient } from '../yuanbao-server/ws/index.js';
import type { CachedSticker } from './sticker-types.js';
import { ResolvedYuanbaoAccount } from '../types.js';
import type { YuanbaoTraceContext } from '../trace/context.js';
export declare function sendStickerYuanbao(params: {
    account: ResolvedYuanbaoAccount;
    config: OpenClawConfig;
    wsClient: YuanbaoWsClient;
    toAccount: string;
    sticker: CachedSticker;
    refMsgId?: string;
    core: PluginRuntime;
    traceContext?: YuanbaoTraceContext;
}): Promise<{
    ok: boolean;
    error?: string;
}>;
