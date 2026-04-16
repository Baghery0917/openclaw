import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
type RegisterToolParam = Parameters<OpenClawPluginApi['registerTool']>[0];
type ToolFactory = Extract<RegisterToolParam, (...args: any[]) => any>;
export type OpenClawPluginToolContext = Parameters<ToolFactory>[0];
export declare function isYbGroupChat(ctx: OpenClawPluginToolContext): boolean;
export declare function extractGroupCode(sessionKey: string): string;
export declare function text(t: string): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function json(data: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export {};
