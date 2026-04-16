import type { OpenClawPluginCommandDefinition } from 'openclaw/plugin-sdk/core';
export declare const UPGRADE_COMMAND_NAMES: readonly ["/yuanbao-upgrade", "/yuanbaobot-upgrade"];
export declare function parseUpgradeCommand(rawBody: string): {
    matched: boolean;
    version?: string;
};
export declare const yuanbaoUpgradeCommand: OpenClawPluginCommandDefinition;
export declare const yuanbaobotUpgradeCommand: OpenClawPluginCommandDefinition;
