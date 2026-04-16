import type { OpenClawConfig } from 'openclaw/plugin-sdk';
export declare const PLUGIN_ID = "openclaw-plugin-yuanbao";
export declare function isValidVersion(version: string): boolean;
export declare function fetchLatestStableVersion(): Promise<string | null>;
export declare function isPublishedVersionOnNpm(version: string): Promise<boolean>;
export declare function readInstalledVersion(pluginId: string): Promise<string | null>;
export declare function snapshotYuanbaoChannelConfig(config: OpenClawConfig): string | null;
export declare function runOpenClawCommand(args: string[], timeoutMs?: number): Promise<{
    ok: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
}>;
export declare function runOpenClawCommandWithRetry(params: {
    args: string[];
    timeoutMs?: number;
    commandName: string;
    onRetry?: (info: {
        nextAttempt: number;
        maxAttempts: number;
    }) => Promise<void>;
}): Promise<Awaited<ReturnType<typeof runOpenClawCommand>>>;
