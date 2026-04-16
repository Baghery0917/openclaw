class DirectoryLRUCache {
    maxSize;
    ttlMs;
    cache = new Map();
    constructor(maxSize = 2000, ttlMs = 30 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }
    get(key) {
        const normalizedKey = key.toLowerCase();
        const item = this.cache.get(normalizedKey);
        if (!item)
            return undefined;
        if (Date.now() > item.expiresAt) {
            this.cache.delete(normalizedKey);
            return undefined;
        }
        this.cache.delete(normalizedKey);
        this.cache.set(normalizedKey, item);
        return item.entry;
    }
    set(key, entry) {
        const normalizedKey = key.toLowerCase();
        this.cache.delete(normalizedKey);
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(normalizedKey, {
            entry,
            expiresAt: Date.now() + this.ttlMs,
        });
    }
    clear() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
}
const directoryCache = new DirectoryLRUCache(2000, 30 * 60 * 1000);
export function getCachedMember(key) {
    return directoryCache.get(key);
}
export function cacheMember(key, entry) {
    directoryCache.set(key, entry);
}
export function clearDirectoryCache() {
    directoryCache.clear();
}
