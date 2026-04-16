import { getMember } from '../module/member.js';
import { extractGroupCode, json } from './utils.js';
function createQueryGroupInfoTool(ctx) {
    const sessionKey = ctx.sessionKey ?? '';
    const accountId = ctx.agentAccountId ?? '';
    return {
        name: 'query_group_info',
        label: 'Query Group Info',
        description: 'Query basic info about the current group (called "派/Pai" in the app), '
            + 'including group name, group owner, and member count.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
        async execute(_toolCallId, _params) {
            const groupCode = extractGroupCode(sessionKey);
            if (!groupCode) {
                return json({ success: false, msg: 'No group context available, unable to query group info.' });
            }
            const memberInst = getMember(accountId);
            const groupInfo = await memberInst.queryGroupInfo(groupCode);
            if (!groupInfo) {
                return json({ success: false, msg: 'Failed to query group info. The API may be unavailable.' });
            }
            return json({
                success: true,
                msg: 'Group info retrieved.',
                note: 'The group is called "派 (Pai)" in the app.',
                groupInfo: {
                    groupName: groupInfo.groupName,
                    groupSize: groupInfo.groupSize,
                    owner: {
                        nickname: groupInfo.ownerNickName,
                        userId: groupInfo.ownerUserId,
                    },
                },
            });
        },
    };
}
export function registerGroupTools(api) {
    api.registerTool(createQueryGroupInfoTool, { optional: false });
}
