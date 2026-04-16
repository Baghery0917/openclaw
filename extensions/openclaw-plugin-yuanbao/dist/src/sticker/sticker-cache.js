import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
function getCacheFilePath() {
    return join(homedir(), '.openclaw', 'state', 'yuanbao', 'sticker-cache.json');
}
function ensureCacheDir(filePath) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
function asStickersRecord(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
const CURRENT_VERSION = 1;
export function loadCache() {
    const filePath = getCacheFilePath();
    if (!existsSync(filePath)) {
        return { version: CURRENT_VERSION, stickers: {} };
    }
    try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const stickers = asStickersRecord(parsed.stickers);
        return {
            version: typeof parsed.version === 'number' ? parsed.version : CURRENT_VERSION,
            stickers,
        };
    }
    catch {
        return { version: CURRENT_VERSION, stickers: {} };
    }
}
export function saveCache(cache) {
    const filePath = getCacheFilePath();
    ensureCacheDir(filePath);
    writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
}
export function cacheSticker(sticker) {
    const cache = loadCache();
    cache.stickers[sticker.sticker_id] = sticker;
    saveCache(cache);
}
export function cacheStickers(stickers) {
    if (stickers.length === 0)
        return;
    const cache = loadCache();
    for (const sticker of stickers) {
        const existing = cache.stickers[sticker.sticker_id];
        if (sticker.source === 'builtin' && existing?.source === 'received')
            continue;
        cache.stickers[sticker.sticker_id] = sticker;
    }
    saveCache(cache);
}
export function getCachedSticker(stickerId) {
    const cache = loadCache();
    return cache.stickers[stickerId];
}
function normalizeStickerMatchText(raw) {
    return String(raw ?? '')
        .normalize('NFKC')
        .trim()
        .toLowerCase();
}
function compactStickerMatchText(s) {
    return normalizeStickerMatchText(s).replace(/[\s\u3000\-_·.,，。!！?？"“”'‘’、/\\]+/g, '');
}
function bigramSet(s) {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) {
        set.add(s.slice(i, i + 2));
    }
    return set;
}
function stickerBigramJaccard(a, b) {
    if (a.length < 2 || b.length < 2)
        return 0;
    const A = bigramSet(a);
    const B = bigramSet(b);
    let inter = 0;
    for (const x of A) {
        if (B.has(x)) {
            inter++;
        }
    }
    const union = A.size + B.size - inter;
    return union === 0 ? 0 : inter / union;
}
function multisetCharHitRatio(needleCompact, hayCompact) {
    if (!needleCompact.length)
        return 0;
    const bag = new Map();
    for (const ch of hayCompact) {
        bag.set(ch, (bag.get(ch) ?? 0) + 1);
    }
    let hits = 0;
    for (const ch of needleCompact) {
        const n = bag.get(ch) ?? 0;
        if (n > 0) {
            hits++;
            bag.set(ch, n - 1);
        }
    }
    return hits / needleCompact.length;
}
function longestSubsequenceRatio(needle, haystack) {
    if (!needle.length)
        return 0;
    let j = 0;
    for (let i = 0; i < haystack.length && j < needle.length; i++) {
        if (haystack[i] === needle[j]) {
            j++;
        }
    }
    return j / needle.length;
}
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    const row = new Array(n + 1);
    for (let j = 0; j <= n; j++) {
        row[j] = j;
    }
    for (let i = 1; i <= m; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= n; j++) {
            const tmp = row[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
            prev = tmp;
        }
    }
    return row[n];
}
function asciiFuzzyStickerScore(needleNorm, hayNorm) {
    if (needleNorm.length < 2 || needleNorm.length > 14)
        return 0;
    if (!/^[\x00-\x7f]+$/.test(needleNorm))
        return 0;
    const h = hayNorm.replace(/[^a-z0-9]/g, '');
    if (h.length < needleNorm.length - 1 || h.length > 36)
        return 0;
    const slice = h.length > needleNorm.length + 6 ? h.slice(0, needleNorm.length + 6) : h;
    const d = levenshtein(needleNorm, slice);
    const maxL = Math.max(needleNorm.length, slice.length, 1);
    return Math.max(0, (1 - d / maxL) * 38);
}
function scoreStickerFieldAgainstQuery(haystack, rawQuery) {
    const hay = normalizeStickerMatchText(haystack);
    const q = normalizeStickerMatchText(rawQuery);
    if (!hay || !q)
        return 0;
    const hayC = compactStickerMatchText(haystack);
    const qC = compactStickerMatchText(rawQuery);
    let best = 0;
    if (hay === q)
        best = Math.max(best, 100);
    if (hay.includes(q))
        best = Math.max(best, 92 + Math.min(6, q.length));
    if (q.length >= 2 && hay.startsWith(q))
        best = Math.max(best, 88);
    if (qC.length > 0 && hayC.includes(qC))
        best = Math.max(best, 86);
    const charR = multisetCharHitRatio(qC, hayC);
    best = Math.max(best, charR * 62);
    const jac = stickerBigramJaccard(qC, hayC);
    best = Math.max(best, jac * 58);
    const sub = longestSubsequenceRatio(qC, hayC);
    best = Math.max(best, sub * 52);
    best = Math.max(best, asciiFuzzyStickerScore(q, hay));
    if (q.length === 1 && hay.includes(q))
        best = Math.max(best, 68);
    return best;
}
function scoreStickerFieldAgainstTokens(haystack, tokens) {
    if (tokens.length === 0)
        return 0;
    const parts = tokens.map(t => scoreStickerFieldAgainstQuery(haystack, t));
    const mean = parts.reduce((a, b) => a + b, 0) / parts.length;
    const weakest = Math.min(...parts);
    return weakest * 0.35 + mean * 0.65;
}
function tokenizeStickerQuery(raw) {
    const q = normalizeStickerMatchText(raw);
    return q.split(/\s+/).filter(Boolean);
}
function scoreStickerTextAgainstQuery(haystack, rawQuery) {
    const full = scoreStickerFieldAgainstQuery(haystack, rawQuery);
    const tokens = tokenizeStickerQuery(rawQuery);
    if (tokens.length <= 1)
        return full;
    const multi = scoreStickerFieldAgainstTokens(haystack, tokens);
    return Math.max(full, multi);
}
export function searchStickers(query, limit = 10) {
    const cache = loadCache();
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit)) || 10));
    const q = normalizeStickerMatchText(query);
    if (!q) {
        return Object.values(cache.stickers).slice(0, safeLimit);
    }
    const scored = [];
    for (const sticker of Object.values(cache.stickers)) {
        const name = String(sticker.name ?? '').trim();
        const desc = String(sticker.description ?? '').trim();
        const id = String(sticker.sticker_id ?? '').trim();
        const nameS = scoreStickerTextAgainstQuery(name, query);
        const descS = scoreStickerTextAgainstQuery(desc, query) * 0.88;
        const idNorm = normalizeStickerMatchText(id);
        const idQ = normalizeStickerMatchText(query);
        let idS = 0;
        if (id && idQ) {
            if (idNorm === idQ)
                idS = 100;
            else if (idNorm.includes(idQ))
                idS = 84;
        }
        const score = Math.max(nameS, descS, idS);
        scored.push({ sticker, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0]?.score ?? 0;
    if (top <= 0) {
        return Object.values(cache.stickers).slice(0, safeLimit);
    }
    let floor;
    if (top >= 22) {
        floor = 18;
    }
    else if (top >= 12) {
        floor = Math.max(10, top * 0.5);
    }
    else {
        floor = Math.max(6, top * 0.35);
    }
    const filtered = scored.filter(s => s.score >= floor);
    const list = filtered.length > 0 ? filtered : scored;
    return list.slice(0, safeLimit).map(s => s.sticker);
}
