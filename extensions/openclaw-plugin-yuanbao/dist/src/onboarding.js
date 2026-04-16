import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk/core';
import { resolveYuanbaoAccount } from './accounts.js';
const channel = 'yuanbao';
async function noteYuanbaoCredentialHelp(prompter) {
    await prompter.note([
        'You\'ll need values from YuanBao APP:',
        '',
        '• AppID & AppSecret → Create a robot from your Yuanbao APP to obtain.',
    ].join('\n'), 'YuanBao Bot credentials');
}
export const yuanbaoOnboardingAdapter = {
    channel,
    getStatus: async ({ cfg }) => {
        const account = resolveYuanbaoAccount({ cfg: cfg });
        const { configured } = account;
        const statusLines = [];
        if (!configured) {
            statusLines.push('YuanBao Bot: needs AppID + AppSecret');
        }
        else {
            statusLines.push(`YuanBao Bot: configured (AppID=${account.appKey ?? '?'})`);
        }
        return {
            channel,
            configured,
            statusLines,
            selectionHint: configured ? 'configured' : 'needs credentials',
            quickstartScore: configured ? 2 : 0,
        };
    },
    configure: async ({ cfg, prompter }) => {
        const yuanbaoCfg = cfg.channels?.yuanbao;
        const hasConfigCreated = Boolean(yuanbaoCfg?.appKey?.trim() && yuanbaoCfg?.appSecret?.trim());
        let next = cfg;
        let appKey = null;
        let appSecret = null;
        if (!hasConfigCreated) {
            await noteYuanbaoCredentialHelp(prompter);
        }
        if (hasConfigCreated) {
            const keep = await prompter.confirm({
                message: 'YuanBao Bot credentials already configured. Keep them?',
                initialValue: true,
            });
            if (!keep) {
                appKey = String(await prompter.text({
                    message: 'Enter App ID (from bot application settings)',
                    validate: value => (value?.trim() ? undefined : 'Required'),
                })).trim();
                appSecret = String(await prompter.text({
                    message: 'Enter App Secret (from bot application settings)',
                    validate: value => (value?.trim() ? undefined : 'Required'),
                })).trim();
            }
        }
        else {
            appKey = String(await prompter.text({
                message: 'Enter App ID (from bot application settings)',
                validate: value => (value?.trim() ? undefined : 'Required'),
            })).trim();
            appSecret = String(await prompter.text({
                message: 'Enter App Secret (from bot application settings)',
                validate: value => (value?.trim() ? undefined : 'Required'),
            })).trim();
        }
        if (appKey && appSecret) {
            next = {
                ...next,
                channels: {
                    ...next.channels,
                    yuanbao: {
                        ...next.channels?.yuanbao,
                        enabled: true,
                        appKey,
                        appSecret,
                    },
                },
            };
        }
        next = {
            ...next,
            channels: {
                ...next.channels,
                yuanbao: {
                    ...next.channels?.yuanbao,
                    enabled: true,
                },
            },
        };
        return { cfg: next, accountId: DEFAULT_ACCOUNT_ID };
    },
    disable: cfg => ({
        ...cfg,
        channels: {
            ...cfg.channels,
            yuanbao: { ...cfg.channels?.yuanbao, enabled: false },
        },
    }),
};
