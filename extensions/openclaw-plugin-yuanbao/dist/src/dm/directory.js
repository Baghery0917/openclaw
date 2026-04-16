import { createLog } from '../logger.js';
import { getMember } from '../module/member.js';
import { getCachedMember, cacheMember } from './directory-cache.js';
export function resolveUsername(nameOrHandle, accountId, groupCode = '') {
    if (!nameOrHandle.trim())
        return null;
    const log = createLog('dm:directory');
    const query = nameOrHandle.trim();
    const cached = getCachedMember(query);
    if (cached) {
        return cached;
    }
    const member = getMember(accountId);
    const groupCodes = groupCode ? [groupCode] : member.listGroupCodes();
    for (const code of groupCodes) {
        const results = member.lookupUsers(code, query);
        if (results.length > 0) {
            const exactMatch = results.find(u => u.nickName.toLowerCase() === query.toLowerCase()
                || u.userId.toLowerCase() === query.toLowerCase());
            const best = exactMatch ?? results[0];
            const entry = {
                userId: best.userId,
                nickName: best.nickName,
            };
            cacheMember(query, entry);
            cacheMember(best.nickName, entry);
            cacheMember(best.userId, entry);
            return entry;
        }
    }
    log.error('用户未找到', { query });
    return null;
}
export function listKnownPeers(accountId) {
    const member = getMember(accountId);
    const seen = new Set();
    const entries = [];
    const groupCodes = member.listGroupCodes();
    for (const groupCode of groupCodes) {
        const users = member.lookupUsers(groupCode);
        for (const u of users) {
            if (!seen.has(u.userId)) {
                seen.add(u.userId);
                entries.push({
                    kind: 'user',
                    userId: u.userId,
                    nickName: u.nickName,
                });
            }
        }
    }
    return entries;
}
