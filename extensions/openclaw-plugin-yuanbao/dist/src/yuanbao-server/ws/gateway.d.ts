import type { OpenClawConfig, PluginRuntime } from 'openclaw/plugin-sdk';
import type { ResolvedYuanbaoAccount, YuanbaoInboundMessage } from '../../types.js';
import type { WsPushEvent } from './types.js';
type GatewayLog = {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
    debug?: (msg: string) => void;
};
type GatewayStatusPatch = Record<string, unknown>;
export type StartWsGatewayParams = {
    account: ResolvedYuanbaoAccount;
    config: OpenClawConfig;
    abortSignal: AbortSignal;
    log?: GatewayLog;
    runtime?: PluginRuntime;
    statusSink?: (patch: GatewayStatusPatch) => void;
};
export declare function startYuanbaoWsGateway(params: StartWsGatewayParams): Promise<void>;
type InboundResult = {
    msg: YuanbaoInboundMessage;
    chatType: 'c2c' | 'group';
};
export declare function wsPushToInboundMessage(pushEvent: WsPushEvent, log?: GatewayLog): InboundResult | null;
export {};
