import { cacheStickers } from './sticker-cache.js';
import builtinStickers from './builtin-stickers.json' with { type: 'json' };
export function initBuiltinStickers() {
    const now = new Date().toISOString();
    const list = builtinStickers;
    const stickers = list.map(s => ({
        sticker_id: s.emoji_id,
        package_id: s.emoji_pack_id,
        name: s.name,
        description: (s.description?.trim() ? `${s.name} ${s.description.trim()}` : s.name),
        cachedAt: now,
        source: 'builtin',
        width: s.width,
        height: s.height,
        formats: s.formats,
    }));
    cacheStickers(stickers);
}
