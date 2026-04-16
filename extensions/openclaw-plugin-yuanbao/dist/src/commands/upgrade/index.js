import { performUpgrade } from './upgrade.js';
export const UPGRADE_COMMAND_NAMES = ['/yuanbao-upgrade', '/yuanbaobot-upgrade'];
export function parseUpgradeCommand(rawBody) {
    const body = rawBody.trim();
    for (const name of UPGRADE_COMMAND_NAMES) {
        if (body === name)
            return { matched: true };
        if (body.startsWith(`${name} `)) {
            const version = body.slice(name.length + 1).trim() || undefined;
            return { matched: true, version };
        }
    }
    return { matched: false };
}
function makeUpgradeCommand(name, description) {
    return {
        name,
        description,
        requireAuth: false,
        handler: async (ctx) => {
            const requested = ctx.args?.trim() || undefined;
            const text = await performUpgrade(ctx.config, ctx.accountId, undefined, requested);
            return { text };
        },
    };
}
export const yuanbaoUpgradeCommand = makeUpgradeCommand(UPGRADE_COMMAND_NAMES[0].slice(1), '升级 openclaw-plugin-yuanbao 插件到最新正式版本');
export const yuanbaobotUpgradeCommand = makeUpgradeCommand(UPGRADE_COMMAND_NAMES[1].slice(1), '升级 openclaw-plugin-yuanbao 插件到最新正式版本（别名）');
