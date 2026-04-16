import { createReadStream, statSync, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import path, { basename, extname, join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { apiGetDownloadUrl, apiGetUploadInfo } from './yuanbao-server/api.js';
const DEFAULT_MAX_MB = 20;
export const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.tiff', '.ico']);
export function guessMimeType(filename) {
    const ext = extname(filename).toLowerCase();
    const mime = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.heic': 'image/heic',
        '.tiff': 'image/tiff',
        '.ico': 'image/x-icon',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.zip': 'application/zip',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.webm': 'video/webm',
    };
    return mime[ext] ?? 'application/octet-stream';
}
function isImage(filename, mimeType) {
    if (mimeType?.startsWith('image/'))
        return true;
    return IMAGE_EXTS.has(extname(filename).toLowerCase());
}
function generateFileId() {
    return randomBytes(16).toString('hex');
}
function md5Hex(buffer) {
    return createHash('md5').update(buffer)
        .digest('hex');
}
export function parseImageSize(buf) {
    return parsePngSize(buf) ?? parseJpegSize(buf) ?? parseGifSize(buf) ?? parseWebpSize(buf);
}
function parsePngSize(buf) {
    if (buf.length < 24)
        return undefined;
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47)
        return undefined;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
function parseJpegSize(buf) {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8)
        return undefined;
    let i = 2;
    while (i < buf.length - 9) {
        if (buf[i] !== 0xff) {
            i++;
            continue;
        }
        const marker = buf[i + 1];
        if (marker === 0xc0 || marker === 0xc2) {
            return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        if (i + 3 < buf.length) {
            i += 2 + buf.readUInt16BE(i + 2);
        }
        else {
            break;
        }
    }
    return undefined;
}
function parseGifSize(buf) {
    if (buf.length < 10)
        return undefined;
    const sig = buf.toString('ascii', 0, 6);
    if (sig !== 'GIF87a' && sig !== 'GIF89a')
        return undefined;
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}
function parseWebpSize(buf) {
    if (buf.length < 16)
        return undefined;
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP')
        return undefined;
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') {
        if (buf.length >= 30 && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
            return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
        }
    }
    if (chunk === 'VP8L') {
        if (buf.length >= 25 && buf[20] === 0x2f) {
            const bits = buf.readUInt32LE(21);
            return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
    }
    if (chunk === 'VP8X') {
        if (buf.length >= 30) {
            return {
                width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
                height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1,
            };
        }
    }
    return undefined;
}
function isLocalPath(s) {
    return (s.startsWith('file://')
        || s === '~'
        || s.startsWith('~/')
        || s.startsWith('~\\')
        || s.startsWith('/')
        || /^[a-zA-Z]:[/\\]/.test(s)
        || s.startsWith('\\\\')
        || s.startsWith('./')
        || s.startsWith('../')
        || s.startsWith('.\\')
        || s.startsWith('..\\')
        || !s.includes('://'));
}
function normalizePath(s) {
    let p = s.trim();
    if (p.startsWith('file://')) {
        try {
            p = decodeURIComponent(new URL(p).pathname);
        }
        catch {
            p = p.slice('file://'.length);
        }
    }
    if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
        p = homedir() + p.slice(1);
    }
    if (!path.isAbsolute(p)) {
        p = path.resolve(p);
    }
    return p;
}
const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
};
function extractFilenameFromContentDisposition(contentDisp) {
    const match = contentDisp.match(/filename\*?=(?:UTF-8'')?["']?([^;"'\r\n]+)/i);
    if (!match)
        return '';
    return decodeURIComponent(match[1].replace(/"/g, '')).trim();
}
function inferFilenameFromResponse(response, fetchUrl, contentType) {
    const fromDisp = extractFilenameFromContentDisposition(response.headers.get('content-disposition') ?? '');
    if (fromDisp)
        return fromDisp;
    const fromPath = basename(new URL(fetchUrl).pathname).trim();
    if (fromPath) {
        const inferredExt = MIME_TO_EXT[contentType] ?? (contentType.startsWith('image/') ? `.${contentType.split('/')[1]}` : '');
        return extname(fromPath) ? fromPath : `${fromPath}${inferredExt}`;
    }
    const inferredExt = MIME_TO_EXT[contentType] ?? '';
    return `${randomBytes(8).toString('hex')}${inferredExt}`;
}
async function resolveFetchUrl(url, account) {
    const parsed = new URL(url);
    const resourceId = parsed.searchParams.get('resourceId');
    if (resourceId && account) {
        return apiGetDownloadUrl(account, resourceId);
    }
    return url;
}
export async function downloadMediaForYuanbao(url, maxMb = DEFAULT_MAX_MB, account) {
    const maxBytes = maxMb * 1024 * 1024;
    if (isLocalPath(url)) {
        const filePath = normalizePath(url);
        const stat = statSync(filePath);
        if (stat.size > maxBytes) {
            throw new Error(`文件过大: ${(stat.size / 1024 / 1024).toFixed(1)} MB > ${maxMb} MB`);
        }
        const chunks = [];
        await new Promise((resolve, reject) => {
            const stream = createReadStream(filePath);
            stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('end', resolve);
            stream.on('error', reject);
        });
        const data = Buffer.concat(chunks);
        const filename = basename(filePath);
        return { filename, data, mimeType: guessMimeType(filename) };
    }
    const fetchUrl = await resolveFetchUrl(url, account);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`下载失败: HTTP ${response.status} ${response.statusText} — ${fetchUrl}`);
    }
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (contentLength > 0 && contentLength > maxBytes) {
        throw new Error(`文件过大: ${(contentLength / 1024 / 1024).toFixed(1)} MB > ${maxMb} MB`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > maxBytes) {
        throw new Error(`文件过大: ${(data.length / 1024 / 1024).toFixed(1)} MB > ${maxMb} MB`);
    }
    const contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    const filename = inferFilenameFromResponse(response, fetchUrl, contentType);
    const mimeType = contentType || guessMimeType(filename);
    return { filename, data, mimeType };
}
async function downloadMediaForLocal(url, core, mediaLocalRoots, account) {
    if (!account) {
        throw new Error('account is required');
    }
    try {
        const loaded = await core.media.loadWebMedia(url, {
            maxBytes: account.mediaMaxMb * 1024 * 1024,
            optimizeImages: false,
            localRoots: mediaLocalRoots?.length ? mediaLocalRoots : undefined,
        });
        const { buffer } = loaded;
        const name = loaded.fileName ?? 'file';
        return { filename: name, data: buffer, mimeType: guessMimeType(name) };
    }
    catch (error) {
    }
    return downloadMediaForYuanbao(url, account.mediaMaxMb, account);
}
async function uploadBufferToCos(params) {
    const { config, data, filename, mimeType } = params;
    let COS;
    try {
        COS = require('cos-nodejs-sdk-v5');
        if (COS?.default)
            COS = COS.default;
    }
    catch {
        try {
            const pkg = await import('cos-nodejs-sdk-v5');
            COS = pkg.default ?? pkg;
        }
        catch {
            throw new Error('缺少依赖 cos-nodejs-sdk-v5，请运行 pnpm add cos-nodejs-sdk-v5');
        }
    }
    const cos = new COS({
        FileParallelLimit: 10,
        getAuthorization(_, callback) {
            callback({
                TmpSecretId: config.encryptTmpSecretId,
                TmpSecretKey: config.encryptTmpSecretKey,
                SecurityToken: config.encryptToken,
                StartTime: config.startTime,
                ExpiredTime: config.expiredTime,
                ScopeLimit: true,
            });
        },
        UseAccelerate: true,
    });
    const headers = {};
    if (isImage(filename, mimeType)) {
        headers['Content-Type'] = mimeType || `image/${extname(filename).slice(1)}`;
        headers['Pic-Operations'] = JSON.stringify({
            is_pic_info: 1,
            rules: [{ fileid: config.location, rule: 'imageMogr2/format/jpg' }],
        });
    }
    else {
        headers['Content-Type'] = 'application/octet-stream';
    }
    await cos.putObject({
        Bucket: config.bucketName,
        Region: config.region,
        Key: config.location,
        Body: data,
        Headers: headers,
        onProgress: params.onProgress
            ? (progressData) => {
                params.onProgress(Math.round(progressData.percent * 10000) / 100);
            }
            : undefined,
    });
    return config.resourceUrl;
}
export async function uploadMediaToCos(mediaFile, account, onProgress) {
    const { filename, data, mimeType } = mediaFile;
    const maxBytes = account.mediaMaxMb * 1024 * 1024;
    if (data.length > maxBytes) {
        throw new Error(`文件过大: ${(data.length / 1024 / 1024).toFixed(1)} MB > ${account.mediaMaxMb} MB`);
    }
    const fileId = generateFileId();
    const uuid = md5Hex(data);
    const imageInfo = mimeType.startsWith('image/') ? parseImageSize(data) : undefined;
    const cosConfig = await apiGetUploadInfo(account, filename, fileId);
    const url = await uploadBufferToCos({ config: cosConfig, data, filename, mimeType, onProgress });
    return {
        url,
        filename,
        size: data.length,
        mimeType,
        uuid,
        imageInfo,
        resourceId: cosConfig.resourceID,
    };
}
export async function downloadAndUploadMedia(mediaUrl, core, account, mediaLocalRoots, onProgress) {
    const mediaFile = await downloadMediaForLocal(mediaUrl, core, mediaLocalRoots, account);
    return uploadMediaToCos(mediaFile, account, onProgress);
}
export function buildImageMsgBody(params) {
    return [
        {
            msg_type: 'TIMImageElem',
            msg_content: {
                uuid: params.uuid ?? params.filename ?? basename(new URL(params.url).pathname) ?? 'image',
                image_format: 255,
                image_info_array: [
                    {
                        type: 1,
                        size: params.size ?? 0,
                        width: params.imageInfo?.width ?? 0,
                        height: params.imageInfo?.height ?? 0,
                        url: params.url,
                    },
                ],
            },
        },
    ];
}
export function buildFileMsgBody(params) {
    return [
        {
            msg_type: 'TIMFileElem',
            msg_content: {
                uuid: params.uuid ?? params.filename,
                file_name: params.filename,
                file_size: params.size ?? 0,
                url: params.url,
            },
        },
    ];
}
export async function downloadMediasToLocalFiles(medias, account, core, log) {
    if (medias.length === 0)
        return { results: [], mediaPaths: [], mediaTypes: [] };
    const maxBytes = account.mediaMaxMb * 1024 * 1024;
    const cacheDir = join(tmpdir(), 'yuanbao-media');
    const tasks = medias.slice(0, 20).map(async ({ url, mediaName }, i) => {
        const mediaFile = await downloadMediaForYuanbao(url, account.mediaMaxMb, account);
        const originalFilename = mediaName || mediaFile.filename;
        const ext = extname(originalFilename).toLowerCase();
        const md5 = md5Hex(mediaFile.data);
        const md5Filename = ext ? `${md5}${ext}` : md5;
        let contentType = mediaFile.mimeType;
        if ((!contentType || contentType === 'application/octet-stream') && typeof core.media?.detectMime === 'function') {
            contentType = (await core.media.detectMime({ buffer: mediaFile.data })) ?? contentType;
        }
        const cachedFilePath = join(cacheDir, md5Filename);
        if (existsSync(cachedFilePath)) {
            log.verbose(`媒体 ${i + 1}/${medias.length} 命中本地缓存，跳过保存: ${cachedFilePath}`);
            return { path: cachedFilePath, contentType };
        }
        if (typeof core.channel.media?.saveMediaBuffer === 'function') {
            const saved = await core.channel.media.saveMediaBuffer(mediaFile.data, contentType, 'inbound', maxBytes, md5Filename);
            return { path: saved.path, contentType: saved.contentType ?? contentType };
        }
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cachedFilePath, mediaFile.data);
        return { path: cachedFilePath, contentType };
    });
    const settled = await Promise.allSettled(tasks);
    const results = [];
    for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        if (r.status === 'fulfilled') {
            results.push(r.value);
            log.verbose(`媒体 ${i + 1}/${medias.length} 下载完成: ${r.value.path} (${r.value.contentType})`);
        }
        else {
            log.warn(`媒体 ${i + 1}/${medias.length} 下载失败，跳过: ${String(r.reason)}`);
        }
    }
    return {
        results,
        mediaPaths: results.map(r => r.path),
        mediaTypes: results.map(r => r.contentType),
    };
}
