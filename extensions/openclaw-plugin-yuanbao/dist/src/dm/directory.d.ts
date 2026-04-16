import type { CachedUserEntry } from './directory-cache.js';
export interface DirectoryEntry {
    kind: 'user' | 'group';
    userId: string;
    nickName: string;
}
export declare function resolveUsername(nameOrHandle: string, accountId: string, groupCode?: string): CachedUserEntry | null;
export declare function listKnownPeers(accountId: string): DirectoryEntry[];
