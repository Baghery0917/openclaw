/**
 * LightClaw — 媒体文件处理工具
 */
import * as path from "node:path";
// ============================================================
// 解析 data URL → Buffer
// ============================================================
export function parseDataUrl(dataUrl) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match)
        return null;
    return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}
// ============================================================
// 格式化文件大小
// ============================================================
export function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
// ============================================================
// MIME 类型猜测
// ============================================================
export function guessMimeByExt(ext) {
    const map = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
        ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
        ".mp4": "video/mp4", ".webm": "video/webm",
        ".pdf": "application/pdf", ".txt": "text/plain",
    };
    return map[ext] || "application/octet-stream";
}
// ============================================================
// 将 AI 引擎返回的 mediaUrl 列表转为 files[] 格式
// ============================================================
export async function mediaUrlsToFiles(urls, log) {
    const files = [];
    const { readFileSync, existsSync } = await import("node:fs");
    for (const url of urls) {
        try {
            let buffer;
            let mimeType;
            let name;
            if (url.startsWith("data:")) {
                const parsed = parseDataUrl(url);
                if (!parsed)
                    continue;
                buffer = parsed.buffer;
                mimeType = parsed.mimeType;
                name = "file";
            }
            else if (url.startsWith("http://") || url.startsWith("https://")) {
                const resp = await fetch(url);
                if (!resp.ok)
                    continue;
                buffer = Buffer.from(await resp.arrayBuffer());
                mimeType = resp.headers.get("content-type") || "application/octet-stream";
                name = url.split("/").pop()?.split("?")[0] || "file";
            }
            else if (existsSync(url)) {
                buffer = readFileSync(url);
                const ext = path.extname(url).toLowerCase();
                mimeType = guessMimeByExt(ext);
                name = path.basename(url);
            }
            else {
                continue;
            }
            files.push({
                name,
                mimeType,
                bytes: `data:${mimeType};base64,${buffer.toString("base64")}`,
            });
        }
        catch (err) {
            log?.warn?.(`[mediaUrlsToFiles] Failed to convert ${url}: ${err}`);
        }
    }
    return files;
}
//# sourceMappingURL=media.js.map