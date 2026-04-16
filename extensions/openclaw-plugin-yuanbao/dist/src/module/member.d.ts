export type UserRecord = {
    userId: string;
    nickName: string;
    lastSeen: number;
    userType?: number;
};
export declare class SessionMember {
    private groupUsers;
    recordUser(groupCode: string, userId: string, nickName: string): void;
    lookupUsers(groupCode: string, nameFilter?: string): UserRecord[];
    lookupUserByNickName(groupCode: string, nickName: string): UserRecord | undefined;
    lookupUserById(groupCode: string, userId: string): UserRecord | undefined;
    upsertUser(groupCode: string, record: UserRecord): void;
    listGroupCodes(): string[];
    private cleanExpired;
}
export type GroupOwnerInfo = {
    userId: string;
    nickName: string;
};
export type GroupInfoData = {
    groupName: string;
    ownerUserId: string;
    ownerNickName: string;
    groupSize: number;
};
export declare class GroupMember {
    private readonly accountId;
    private readonly sessionMember;
    private cache;
    private ownerCache;
    private infoCache;
    constructor(accountId: string, sessionMember: SessionMember);
    getMembers(groupCode: string): Promise<UserRecord[]>;
    lookupUsers(groupCode: string, nameFilter?: string): UserRecord[];
    lookupUserByNickName(groupCode: string, nickName: string): UserRecord | undefined;
    hasCachedData(groupCode: string): boolean;
    refresh(groupCode: string): Promise<UserRecord[]>;
    queryGroupOwner(groupCode: string): Promise<GroupOwnerInfo | null>;
    queryGroupInfo(groupCode: string): Promise<GroupInfoData | null>;
    private fetchFromApi;
}
export type FormattedUserRecord = {
    userId: string;
    nickName: string;
    lastSeen: string;
};
export declare class Member {
    readonly accountId: string;
    readonly session: SessionMember;
    readonly group: GroupMember;
    private yuanbaoUserIdCache;
    constructor(accountId: string);
    recordUser(groupCode: string, userId: string, nickName: string): void;
    queryMembers(groupCode: string, nameFilter?: string): Promise<UserRecord[]>;
    lookupUsers(groupCode: string, nameFilter?: string): UserRecord[];
    lookupUserByNickName(groupCode: string, nickName: string): UserRecord | undefined;
    queryGroupOwner(groupCode: string): Promise<GroupOwnerInfo | null>;
    queryGroupInfo(groupCode: string): Promise<GroupInfoData | null>;
    queryYuanbaoUserId(groupCode?: string): Promise<string | null>;
    listGroupCodes(): string[];
    formatRecords(records: UserRecord[]): FormattedUserRecord[];
}
export declare function getMember(accountId: string): Member;
export declare function removeMember(accountId: string): void;
export declare function getAllActiveMembers(): ReadonlyMap<string, Member>;
