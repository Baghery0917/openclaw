import { getMember } from '../module/member.js';
import { extractGroupCode, json } from './utils.js';
const MENTION_HINT_TEXT = 'To @mention a user, you MUST use the format: space + @ + nickname + space (e.g. " @Alice ").';
const USER_TYPE_LABEL = {
    0: 'undefined',
    1: 'user',
    2: 'yuanbao',
    3: 'bot',
};
function toMembers(records) {
    return records.map(u => ({
        nickname: u.nickName,
        userId: u.userId,
        ...(u.userType !== undefined ? { role: USER_TYPE_LABEL[u.userType] ?? `type_${u.userType}` } : {}),
    }));
}
function handleListBots(allMembers, mention) {
    const bots = allMembers.filter(u => u.userType === 2 || u.userType === 3);
    if (bots.length === 0) {
        return json({ success: false, msg: 'No bot info available. Role data requires API fetch.' });
    }
    return json({
        success: true,
        msg: `Found ${bots.length} bot(s) in this group.`,
        members: toMembers(bots),
        ...(mention ? { mentionHint: MENTION_HINT_TEXT } : {}),
    });
}
function handleFind(allMembers, nameFilter, mention) {
    const hint = mention ? { mentionHint: MENTION_HINT_TEXT } : {};
    if (nameFilter) {
        const filter = nameFilter.toLowerCase();
        const matched = allMembers.filter(u => u.nickName.toLowerCase().includes(filter));
        if (matched.length > 0) {
            return json({
                success: true,
                msg: `Found ${matched.length} member(s) matching "${nameFilter}".`,
                members: toMembers(matched),
                ...hint,
            });
        }
        return json({
            success: false,
            msg: `No exact match for "${nameFilter}". Please find the target user from the members list below.`,
            members: toMembers(allMembers),
            ...hint,
        });
    }
    return json({
        success: true,
        msg: `Found ${allMembers.length} member(s) in this group.`,
        members: toMembers(allMembers),
        ...hint,
    });
}
function handleListAll(allMembers, mention) {
    return json({
        success: true,
        msg: `Found ${allMembers.length} member(s) in this group.`,
        members: toMembers(allMembers),
        ...(mention ? { mentionHint: MENTION_HINT_TEXT } : {}),
    });
}
function createQuerySessionMembersTool(ctx) {
    const sessionKey = ctx.sessionKey ?? '';
    const accountId = ctx.agentAccountId ?? '';
    return {
        name: 'query_session_members',
        label: 'Query Session Members',
        description: 'Query session members in the current group (called "派/Pai" in the app): '
            + 'find a user by name, @mention someone, list bots (including Yuanbao AI assistants), or list all members.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['find', 'list_bots', 'list_all'],
                    description: 'Interaction type. '
                        + 'find — search a user by name; '
                        + 'list_bots — list bots (including Yuanbao AI assistants) in the group; '
                        + 'list_all — list all recorded members.',
                },
                name: {
                    type: 'string',
                    description: 'User name to search (partial match, case-insensitive). '
                        + 'Required for "find", ignored for other actions.',
                },
                mention: {
                    type: 'boolean',
                    description: 'Set to true when you need to @mention the user(s) in the reply. ',
                },
            },
            required: ['action', 'mention'],
        },
        async execute(_toolCallId, params) {
            const action = typeof params.action === 'string' ? params.action : 'list_all';
            const nameFilter = typeof params.name === 'string' ? params.name.trim() : '';
            const mention = params.mention === true || params.mention === 'true';
            const groupCode = extractGroupCode(sessionKey);
            if (!groupCode) {
                return json({ success: false, msg: 'No group context available, unable to query members.' });
            }
            const allMembers = await getMember(accountId).queryMembers(groupCode);
            if (allMembers.length === 0) {
                return json({ success: false, msg: 'No members recorded in this group yet.' });
            }
            switch (action) {
                case 'list_bots': return handleListBots(allMembers, mention);
                case 'find': return handleFind(allMembers, nameFilter, mention);
                case 'list_all': return handleListAll(allMembers, mention);
                default: return json({
                    success: false,
                    msg: `Unsupported action "${action}". Valid actions: find, list_bots, list_all.`,
                });
            }
        },
    };
}
export function registerMemberTools(api) {
    api.registerTool(createQuerySessionMembersTool, { optional: false });
}
