export interface BuiltinStickerJsonEntry {
    emoji_id: string;
    emoji_pack_id: string;
    name: string;
    description?: string;
    width: number;
    height: number;
    formats: string;
}
export interface CachedSticker {
    sticker_id: string;
    package_id: string;
    name: string;
    description: string;
    cachedAt: string;
    source?: 'builtin' | 'received';
    width?: number;
    height?: number;
    formats?: string;
}
export interface StickerCache {
    version: number;
    stickers: Record<string, CachedSticker>;
}
