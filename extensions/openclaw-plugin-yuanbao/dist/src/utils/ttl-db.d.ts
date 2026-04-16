export declare class InMemoryTtlDb<K, V> {
    private readonly ttlMs;
    private readonly maxKeys;
    private readonly cleanupMinIntervalMs;
    private readonly store;
    private lastCleanupAt;
    constructor(options: {
        ttlMs: number;
        maxKeys?: number;
        cleanupMinIntervalMs?: number;
    });
    has(key: K): boolean;
    get(key: K): V | null;
    set(key: K, value: V): void;
    delete(key: K): boolean;
    size(): number;
    private cleanupExpired;
    private getValidEntry;
    private evictOverflow;
}
