import type { CachedSticker, StickerCache } from './sticker-types.js';
export declare function loadCache(): StickerCache;
export declare function saveCache(cache: StickerCache): void;
export declare function cacheSticker(sticker: CachedSticker): void;
export declare function cacheStickers(stickers: CachedSticker[]): void;
export declare function getCachedSticker(stickerId: string): CachedSticker | undefined;
export declare function searchStickers(query: string, limit?: number): CachedSticker[];
