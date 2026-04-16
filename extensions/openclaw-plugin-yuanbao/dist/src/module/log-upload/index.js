import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { resolveYuanbaoAccount } from '../../accounts.js';
import { sanitize, createLog } from '../../logger.js';
import { uploadToCos } from './cos-upload.js';
import { extractAndFilterLogs } from './extractor.js';
const log = createLog('log-upload');
const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;
const DASH_VARIANTS_RE = /[‐‑‒–—―－]/g;
function toInt(value) {
    if (!value)
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}
function normalizeOptionToken(token) {
    const normalized = token.replace(DASH_VARIANTS_RE, '-');
    if (/^-[A-Za-z]/.test(normalized) && !normalized.startsWith('--')) {
        return `-${normalized}`;
    }
    return normalized;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function parseCommandArgs(rawArgs) {
    const tokens = (rawArgs ?? '').trim().split(/\s+/)
        .map(normalizeOptionToken)
        .filter(Boolean);
    const parsed = {
        limit: DEFAULT_LIMIT,
        uploadCos: true,
        all: false,
    };
    for (let i = 0; i < tokens.length; i += 1) {
        const t = tokens[i];
        const next = tokens[i + 1];
        if (t === '--limit') {
            const n = toInt(next);
            if (n !== undefined) {
                parsed.limit = clamp(n, 1, MAX_LIMIT);
            }
            i += 1;
            continue;
        }
        if (t === '--start-time') {
            const n = toInt(next);
            if (n !== undefined && n > 0)
                parsed.startTime = n;
            i += 1;
            continue;
        }
        if (t === '--h') {
            const n = toInt(next);
            if (n !== undefined && n > 0)
                parsed.recentHours = n;
            i += 1;
            continue;
        }
        if (t === '--d') {
            const n = toInt(next);
            if (n !== undefined && n > 0)
                parsed.recentDays = n;
            i += 1;
            continue;
        }
        if (t === '--end-time') {
            const n = toInt(next);
            if (n !== undefined && n > 0)
                parsed.endTime = n;
            i += 1;
            continue;
        }
        if (t === '--all') {
            parsed.all = true;
        }
    }
    return parsed;
}
function sanitizeLine(rawLine) {
    const safe = sanitize(rawLine);
    return `${safe}`.replace(/\r?\n/g, ' ');
}
function resolveBotIdFromConfig(ctx) {
    const cfg = ctx.config;
    const yuanbao = cfg.channels?.yuanbao;
    if (!yuanbao)
        return undefined;
    const accountCfg = ctx.accountId ? yuanbao.accounts?.[ctx.accountId] : undefined;
    return accountCfg?.botId || accountCfg?.identifier || yuanbao.botId || yuanbao.identifier;
}
function buildTimestamp() {
    return new Date().toISOString()
        .replace(/[:.]/g, '-');
}
async function persistTempBundle(lines) {
    const baseDir = join(tmpdir(), 'openclaw-log-export-');
    const dir = await mkdtemp(baseDir);
    const ts = buildTimestamp();
    const jsonlPath = join(dir, `openclaw-log-${ts}.jsonl`);
    const gzipPath = join(dir, `openclaw-log-${ts}.jsonl.gz`);
    const jsonl = lines.map(sanitizeLine).join('\n');
    await writeFile(jsonlPath, jsonl, 'utf8');
    const gz = gzipSync(Buffer.from(jsonl, 'utf8'));
    await writeFile(gzipPath, gz);
    return { dir, jsonlPath, gzipPath, gzipBytes: gz.byteLength };
}
async function cleanupTempBundle(dir) {
    await rm(dir, { recursive: true, force: true });
}
function renderReply(params) {
    const { cosUpload } = params;
    const successLines = [
        '日志已经打包发送成功，请复制以下【日志码】提供给工作人员进行分析排查：',
        `日志码: ${cosUpload.logId || 'N/A'}`,
    ];
    const errorLines = [
        '导出失败，请稍后重试',
    ];
    return cosUpload.recordLogOk ? successLines.join('\n') : errorLines.join('\n');
}
export async function performLogExport(ctx) {
    const args = parseCommandArgs(ctx.args);
    if (!args.uin) {
        args.uin = resolveBotIdFromConfig(ctx) || ctx.senderId || ctx.accountId || 'unknown';
    }
    const account = resolveYuanbaoAccount({ cfg: ctx.config, accountId: ctx.accountId });
    args.appKey = account.appKey;
    args.appSecret = account.appSecret;
    args.apiDomain = account.apiDomain;
    args.routeEnv = account.config?.routeEnv;
    log.info('开始执行日志导出命令', { args });
    const { extract, filteredLines } = await extractAndFilterLogs(args);
    const output = await persistTempBundle(filteredLines);
    try {
        const cosUpload = await uploadToCos(output.gzipPath, args, account);
        log.info('日志导出完成', {
            source: extract.source,
            rawLineCount: extract.lines.length,
            finalLineCount: filteredLines.length,
            gzipPath: output.gzipPath,
            gzipBytes: output.gzipBytes,
            cosUploadEnabled: cosUpload.enabled,
            cosPath: cosUpload.cosPath,
        });
        return renderReply({
            extract: {
                ...extract,
                lines: filteredLines,
            },
            output,
            cosUpload,
        });
    }
    catch (err) {
        log.error('日志导出/上传失败', { dir: output.dir, error: String(err) });
        throw err;
    }
    finally {
        try {
            await cleanupTempBundle(output.dir);
            log.info('临时目录已清理', { dir: output.dir });
        }
        catch (cleanupErr) {
            log.warn('清理临时目录失败', { dir: output.dir, error: String(cleanupErr) });
        }
    }
}
