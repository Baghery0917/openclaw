import type { OpenClawConfig } from 'openclaw/plugin-sdk';
export declare function performUpgrade(config: OpenClawConfig, accountId?: string, onProgress?: (text: string) => Promise<unknown>, targetVersion?: string): Promise<string>;
