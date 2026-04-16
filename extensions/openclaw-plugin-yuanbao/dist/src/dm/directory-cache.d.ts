export interface CachedUserEntry {
    userId: string;
    nickName?: string;
}
export declare function getCachedMember(key: string): CachedUserEntry | undefined;
export declare function cacheMember(key: string, entry: CachedUserEntry): void;
export declare function clearDirectoryCache(): void;
