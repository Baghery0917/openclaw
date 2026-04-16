import type { OpenClawConfig } from 'openclaw/plugin-sdk';
interface ActionContext {
    channel: string;
    action: string;
    cfg: OpenClawConfig;
    params: Record<string, unknown>;
    accountId?: string | null;
    requesterSenderId?: string | null;
    toolContext: Record<string, string>;
}
interface ActionResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
}
export declare function listActions(): string[];
export declare function supportsAction(action: string): boolean;
export declare function handleAction(ctx: ActionContext): Promise<ActionResult | null>;
export {};
