import { logger } from '../logger.js';
import { getActiveWsClient } from '../yuanbao-server/ws/runtime.js';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export class SessionMember {
    groupUsers = new Map();
    recordUser(groupCode, userId, nickName) {
        if (!userId)
            return;
        if (!this.groupUsers.has(groupCode)) {
            this.groupUsers.set(groupCode, new Map());
        }
        const users = this.groupUsers.get(groupCode);
        users.set(userId, {
            userId,
            nickName: nickName || 'unknown',
            lastSeen: Date.now(),
        });
        this.cleanExpired();
        logger.debug?.(`[member:session] recorded user: ${nickName ?? '?'} (${userId}) in ${groupCode}`);
    }
    lookupUsers(groupCode, nameFilter) {
        const users = this.groupUsers.get(groupCode);
        if (!users || users.size === 0)
            return [];
        let results = Array.from(users.values());
        if (nameFilter) {
            const filter = nameFilter.trim().toLowerCase();
            results = results.filter(u => u.nickName.toLowerCase().includes(filter));
        }
        results.sort((a, b) => b.lastSeen - a.lastSeen);
        return results;
    }
    lookupUserByNickName(groupCode, nickName) {
        const users = this.groupUsers.get(groupCode);
        if (!users || users.size === 0)
            return undefined;
        const target = nickName.trim().toLowerCase();
        for (const record of users.values()) {
            if (record.nickName.toLowerCase() === target) {
                return record;
            }
        }
        return undefined;
    }
    lookupUserById(groupCode, userId) {
        const users = this.groupUsers.get(groupCode);
        return users?.get(userId);
    }
    upsertUser(groupCode, record) {
        if (!this.groupUsers.has(groupCode)) {
            this.groupUsers.set(groupCode, new Map());
        }
        this.groupUsers.get(groupCode).set(record.userId, record);
    }
    listGroupCodes() {
        return Array.from(this.groupUsers.keys());
    }
    cleanExpired() {
        const now = Date.now();
        for (const [code, users] of this.groupUsers) {
            for (const [id, record] of users) {
                if (now - record.lastSeen > SESSION_TTL_MS) {
                    users.delete(id);
                }
            }
            if (users.size === 0) {
                this.groupUsers.delete(code);
            }
        }
    }
}
const GROUP_CACHE_TTL_MS = 5 * 60 * 1000;
export class GroupMember {
    accountId;
    sessionMember;
    cache = new Map();
    ownerCache = new Map();
    infoCache = new Map();
    constructor(accountId, sessionMember) {
        this.accountId = accountId;
        this.sessionMember = sessionMember;
    }
    async getMembers(groupCode) {
        const cached = this.cache.get(groupCode);
        if (cached && Date.now() - cached.fetchedAt < GROUP_CACHE_TTL_MS) {
            logger.debug?.(`[member:group] cache hit for group=${groupCode}, ${cached.members.length} members`);
            return cached.members;
        }
        const fetched = await this.fetchFromApi(groupCode);
        if (fetched.length > 0) {
            this.cache.set(groupCode, { members: fetched, fetchedAt: Date.now() });
            return fetched;
        }
        if (cached) {
            logger.debug?.(`[member:group] fetch failed, returning stale cache for group=${groupCode}`);
            return cached.members;
        }
        return [];
    }
    lookupUsers(groupCode, nameFilter) {
        const cached = this.cache.get(groupCode);
        if (!cached)
            return [];
        let results = cached.members;
        if (nameFilter) {
            const filter = nameFilter.trim().toLowerCase();
            results = results.filter(u => u.nickName.toLowerCase().includes(filter));
        }
        return results;
    }
    lookupUserByNickName(groupCode, nickName) {
        const cached = this.cache.get(groupCode);
        if (!cached)
            return undefined;
        const target = nickName.trim().toLowerCase();
        return cached.members.find(u => u.nickName.toLowerCase() === target);
    }
    hasCachedData(groupCode) {
        return this.cache.has(groupCode);
    }
    async refresh(groupCode) {
        this.cache.delete(groupCode);
        return this.getMembers(groupCode);
    }
    async queryGroupOwner(groupCode) {
        const cached = this.ownerCache.get(groupCode);
        if (cached && Date.now() - cached.fetchedAt < GROUP_CACHE_TTL_MS) {
            logger.debug?.(`[member:group] owner cache hit for group=${groupCode}`);
            return cached.owner;
        }
        const wsClient = getActiveWsClient(this.accountId);
        if (!wsClient) {
            logger.warn?.(`[member:group] no active wsClient for account=${this.accountId}, skip queryGroupOwner`);
            return cached?.owner ?? null;
        }
        if (wsClient.getState() !== 'connected') {
            logger.warn?.(`[member:group] wsClient not connected (state=${wsClient.getState()}), skip queryGroupOwner`);
            return cached?.owner ?? null;
        }
        try {
            logger.debug?.(`[member:group] querying group info: account=${this.accountId}, group=${groupCode}`);
            const rsp = await wsClient.queryGroupInfo({ group_code: groupCode });
            if (rsp.code !== 0 || !rsp.group_info) {
                logger.warn?.(`[member:group] queryGroupInfo failed: code=${rsp.code}, msg=${rsp.msg}`);
                return cached?.owner ?? null;
            }
            const owner = {
                userId: rsp.group_info.group_owner_user_id,
                nickName: rsp.group_info.group_owner_nickname || 'unknown',
            };
            logger.info?.(`[member:group] group owner: ${owner.nickName} (${owner.userId}) for group=${groupCode}`);
            this.ownerCache.set(groupCode, { owner, fetchedAt: Date.now() });
            return owner;
        }
        catch (err) {
            logger.error?.(`[member:group] queryGroupInfo error: ${err instanceof Error ? err.message : String(err)}`);
            return cached?.owner ?? null;
        }
    }
    async queryGroupInfo(groupCode) {
        const cached = this.infoCache.get(groupCode);
        if (cached && Date.now() - cached.fetchedAt < GROUP_CACHE_TTL_MS) {
            logger.debug?.(`[member:group] group info cache hit for group=${groupCode}`);
            return cached.info;
        }
        const wsClient = getActiveWsClient(this.accountId);
        if (!wsClient) {
            logger.warn?.(`[member:group] no active wsClient for account=${this.accountId}, skip queryGroupInfo`);
            return cached?.info ?? null;
        }
        if (wsClient.getState() !== 'connected') {
            logger.warn?.(`[member:group] wsClient not connected (state=${wsClient.getState()}), skip queryGroupInfo`);
            return cached?.info ?? null;
        }
        try {
            logger.debug?.(`[member:group] querying full group info: account=${this.accountId}, group=${groupCode}`);
            const rsp = await wsClient.queryGroupInfo({ group_code: groupCode });
            if (rsp.code !== 0 || !rsp.group_info) {
                logger.warn?.(`[member:group] queryGroupInfo failed: code=${rsp.code}, msg=${rsp.msg}`);
                return cached?.info ?? null;
            }
            const info = {
                groupName: rsp.group_info.group_name || 'unknown',
                ownerUserId: rsp.group_info.group_owner_user_id,
                ownerNickName: rsp.group_info.group_owner_nickname || 'unknown',
                groupSize: rsp.group_info.group_size ?? 0,
            };
            logger.info?.(`[member:group] group info: name=${info.groupName}, size=${info.groupSize}, owner=${info.ownerNickName} for group=${groupCode}`);
            this.infoCache.set(groupCode, { info, fetchedAt: Date.now() });
            const owner = { userId: info.ownerUserId, nickName: info.ownerNickName };
            this.ownerCache.set(groupCode, { owner, fetchedAt: Date.now() });
            return info;
        }
        catch (err) {
            logger.error?.(`[member:group] queryGroupInfo (full) error: ${err instanceof Error ? err.message : String(err)}`);
            return cached?.info ?? null;
        }
    }
    async fetchFromApi(groupCode) {
        const wsClient = getActiveWsClient(this.accountId);
        if (!wsClient) {
            logger.warn?.(`[member:group] no active wsClient for account=${this.accountId}, skip fetch`);
            return [];
        }
        if (wsClient.getState() !== 'connected') {
            logger.warn?.(`[member:group] wsClient not connected (state=${wsClient.getState()}), skip fetch`);
            return [];
        }
        try {
            logger.debug?.(`[member:group] fetching group members: account=${this.accountId}, group=${groupCode}`);
            const rsp = await wsClient.getGroupMemberList({ group_code: groupCode });
            if (rsp.code !== 0) {
                logger.warn?.(`[member:group] getGroupMemberList failed: code=${rsp.code}, msg=${rsp.message}`);
                return [];
            }
            const apiMembers = rsp.member_list ?? [];
            logger.info?.(`[member:group] got ${apiMembers.length} members from API for group=${groupCode}`);
            const now = Date.now();
            const records = [];
            for (const m of apiMembers) {
                const existing = this.sessionMember.lookupUserById(groupCode, m.user_id);
                const record = {
                    userId: m.user_id,
                    nickName: m.nick_name || existing?.nickName || 'unknown',
                    lastSeen: existing?.lastSeen ?? now,
                    userType: m.user_type,
                };
                this.sessionMember.upsertUser(groupCode, record);
                records.push(record);
            }
            return records;
        }
        catch (err) {
            logger.error?.(`[member:group] getGroupMemberList error: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    }
}
export class Member {
    accountId;
    session = new SessionMember();
    group;
    yuanbaoUserIdCache = null;
    constructor(accountId) {
        this.accountId = accountId;
        this.group = new GroupMember(accountId, this.session);
    }
    recordUser(groupCode, userId, nickName) {
        this.session.recordUser(groupCode, userId, nickName);
    }
    async queryMembers(groupCode, nameFilter) {
        const groupMembers = await this.group.getMembers(groupCode);
        if (groupMembers.length > 0) {
            if (!nameFilter)
                return groupMembers;
            const filter = nameFilter.trim().toLowerCase();
            const filtered = groupMembers.filter(u => u.nickName.toLowerCase().includes(filter));
            if (filtered.length > 0)
                return filtered;
        }
        logger.debug?.(`[member] GroupMember empty or no match, fallback to SessionMember for group=${groupCode}`);
        return this.session.lookupUsers(groupCode, nameFilter);
    }
    lookupUsers(groupCode, nameFilter) {
        const groupResults = this.group.lookupUsers(groupCode, nameFilter);
        if (groupResults.length > 0)
            return groupResults;
        return this.session.lookupUsers(groupCode, nameFilter);
    }
    lookupUserByNickName(groupCode, nickName) {
        return this.group.lookupUserByNickName(groupCode, nickName)
            ?? this.session.lookupUserByNickName(groupCode, nickName);
    }
    async queryGroupOwner(groupCode) {
        return this.group.queryGroupOwner(groupCode);
    }
    async queryGroupInfo(groupCode) {
        return this.group.queryGroupInfo(groupCode);
    }
    async queryYuanbaoUserId(groupCode) {
        if (this.yuanbaoUserIdCache)
            return this.yuanbaoUserIdCache;
        if (!groupCode) {
            logger.debug?.('[member] queryYuanbaoUserId skipped: no cache and no groupCode');
            return null;
        }
        const members = await this.group.getMembers(groupCode);
        const yuanbao = members.find(u => u.userType === 2) ?? members.find(u => u.userType === 3);
        if (!yuanbao?.userId) {
            logger.warn?.(`[member] queryYuanbaoUserId failed: no yuanbao/bot found in group=${groupCode}`);
            return null;
        }
        this.yuanbaoUserIdCache = yuanbao.userId;
        logger.info?.(`[member] cached yuanbaoUserId=${yuanbao.userId} from group=${groupCode}`);
        return this.yuanbaoUserIdCache;
    }
    listGroupCodes() {
        return this.session.listGroupCodes();
    }
    formatRecords(records) {
        return records.map(u => ({
            userId: u.userId,
            nickName: u.nickName,
            lastSeen: new Date(u.lastSeen).toISOString(),
        }));
    }
}
const activeMembers = new Map();
export function getMember(accountId) {
    let inst = activeMembers.get(accountId);
    if (!inst) {
        inst = new Member(accountId);
        activeMembers.set(accountId, inst);
        logger.debug?.(`[member:runtime] created Member instance for account=${accountId}`);
    }
    return inst;
}
export function removeMember(accountId) {
    activeMembers.delete(accountId);
    logger.debug?.(`[member:runtime] removed Member instance for account=${accountId}`);
}
export function getAllActiveMembers() {
    return activeMembers;
}
