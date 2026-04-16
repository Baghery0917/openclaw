import type { PluginCommandContext } from 'openclaw/plugin-sdk';
import type { ParsedCommandArgs } from './types.js';
export declare function parseCommandArgs(rawArgs: string | undefined): ParsedCommandArgs;
export declare function performLogExport(ctx: PluginCommandContext): Promise<string>;
