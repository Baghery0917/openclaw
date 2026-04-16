import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
export declare const LOG_PREFIX: string;
export interface PluginLogger {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
}
export declare function initLogger(api: OpenClawPluginApi): void;
export declare const logger: PluginLogger;
export declare function isVerbose(): boolean;
export declare function setDebugBotIds(ids: string[]): void;
export declare function isDebugBotId(botId?: string): boolean;
export interface LogSink {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
    debug?: (msg: string) => void;
    verbose?: (msg: string) => void;
}
export interface ModuleLog {
    info(msg: string, data?: Record<string, unknown>): void;
    warn(msg: string, data?: Record<string, unknown>): void;
    error(msg: string, data?: Record<string, unknown>): void;
    debug(msg: string, data?: Record<string, unknown>): void;
}
export declare function formatLog(module: string, msg: string, data?: Record<string, unknown>, skipSanitize?: boolean): string;
export declare function createLog(module: string, sink?: LogSink, options?: {
    botId?: string;
}): ModuleLog;
export declare function sanitize(value: unknown): string;
export declare function logSimple(level: 'info' | 'warn' | 'error', message: string): void;
export declare function logDebug(message: string): void;
