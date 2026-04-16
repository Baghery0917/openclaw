export class InMemoryTtlDb {
    ttlMs;
    maxKeys;
    cleanupMinIntervalMs;
    store = new Map();
    lastCleanupAt = 0;
    constructor(options) {
        this.ttlMs = options.ttlMs;
        this.maxKeys = options.maxKeys ?? Number.POSITIVE_INFINITY;
        this.cleanupMinIntervalMs = Math.max(0, options.cleanupMinIntervalMs ?? 5_000);
    }
    has(key) {
        this.cleanupExpired();
        return this.getValidEntry(key) !== undefined;
    }
    get(key) {
        this.cleanupExpired();
        return this.getValidEntry(key)?.value ?? null;
    }
    set(key, value) {
        this.cleanupExpired();
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        this.evictOverflow();
    }
    delete(key) {
        this.cleanupExpired();
        return this.store.delete(key);
    }
    size() {
        this.cleanupExpired();
        return this.store.size;
    }
    cleanupExpired() {
        const now = Date.now();
        if (now - this.lastCleanupAt < this.cleanupMinIntervalMs) {
            return;
        }
        this.lastCleanupAt = now;
        for (const [key, entry] of this.store) {
            if (entry.expiresAt <= now) {
                this.store.delete(key);
            }
        }
    }
    getValidEntry(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry;
    }
    evictOverflow() {
        if (this.store.size <= this.maxKeys)
            return;
        const overflow = this.store.size - this.maxKeys;
        const keysByExpiryAsc = Array.from(this.store.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
            .map(([key]) => key);
        for (let i = 0; i < overflow; i++) {
            const key = keysByExpiryAsc[i];
            if (key === undefined)
                break;
            this.store.delete(key);
        }
    }
}
