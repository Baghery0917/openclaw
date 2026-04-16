import { readFile, readdir, stat } from 'node:fs/promises';
import { runPluginCommandWithTimeout } from 'openclaw/plugin-sdk/matrix';
import { createLog } from '../../logger.js';
import { getYuanbaoRuntime } from '../../runtime.js';
const log = createLog('log-upload');
const EXEC_TIMEOUT_MS = 10_000;
const FILTER_FETCH_LIMIT = 5000;
async function resolveOpenclawBin() {
    try {
        const result = await runPluginCommandWithTimeout({ argv: ['which', 'openclaw'], timeoutMs: 3000 });
        const resolved = result.stdout.trim();
        if (result.code === 0 && resolved)
            return resolved;
    }
    catch {
    }
    return 'openclaw';
}
async function readConfigValue(openclawBin, key) {
    try {
        const result = await runPluginCommandWithTimeout({
            argv: [openclawBin, 'config', 'get', key],
            timeoutMs: EXEC_TIMEOUT_MS,
        });
        if (result.code !== 0)
            return undefined;
        const raw = result.stdout.trim();
        return raw || undefined;
    }
    catch {
        return undefined;
    }
}
async function resolveLatestTmpOpenclawLog() {
    const logDir = '/tmp/openclaw';
    let files = [];
    try {
        files = await readdir(logDir);
    }
    catch {
        return undefined;
    }
    const candidates = files
        .filter(name => /^openclaw-\d{4}-\d{2}-\d{2}\.log$/.test(name))
        .map(name => `${logDir}/${name}`);
    if (candidates.length === 0)
        return undefined;
    let latestPath;
    let latestMtime = -1;
    for (const filePath of candidates) {
        try {
            const fileStat = await stat(filePath);
            const mtime = fileStat.mtimeMs ?? 0;
            if (mtime > latestMtime) {
                latestMtime = mtime;
                latestPath = filePath;
            }
        }
        catch {
        }
    }
    return latestPath;
}
function buildTodayLogPath() {
    const date = new Date().toISOString()
        .slice(0, 10);
    return `/tmp/openclaw/openclaw-${date}.log`;
}
async function readOpenclawLoggingFileFromConfig() {
    const openclawBin = await resolveOpenclawBin();
    const configKeys = ['logging.file', 'gateway.logging.file', 'logs.file'];
    for (const key of configKeys) {
        const value = await readConfigValue(openclawBin, key);
        if (value)
            return value;
    }
    const latestTmpLog = await resolveLatestTmpOpenclawLog();
    if (latestTmpLog)
        return latestTmpLog;
    return buildTodayLogPath();
}
function needsPostFilter(args) {
    return !args.all || !!resolveTimeRange(args);
}
function resolveExtractLimit(args) {
    return needsPostFilter(args) ? Math.max(args.limit, FILTER_FETCH_LIMIT) : args.limit;
}
async function tailLinesFromFile(filePath, maxLines) {
    const fileStat = await stat(filePath);
    const size = Number(fileStat.size ?? 0);
    const content = await readFile(filePath);
    const lines = content
        .toString('utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-maxLines);
    return { lines, size };
}
async function extractViaLogsTail(params) {
    const runtime = getYuanbaoRuntime();
    const requestParams = {
        limit: resolveExtractLimit(params),
    };
    const tryFns = [];
    if (typeof runtime.logs?.tail === 'function') {
        tryFns.push(() => runtime.logs.tail(requestParams));
    }
    if (typeof runtime.gateway?.request === 'function') {
        tryFns.push(() => runtime.gateway.request('logs.tail', requestParams));
    }
    if (tryFns.length === 0)
        return null;
    let lastErr;
    for (const fn of tryFns) {
        try {
            const rsp = await fn();
            if (!rsp || !Array.isArray(rsp.lines)) {
                throw new Error('logs.tail 返回格式不正确');
            }
            return {
                source: 'logs.tail',
                file: rsp.file ?? '(unknown)',
                lines: rsp.lines.map(line => `${line}`),
                truncated: !!rsp.truncated,
                reset: !!rsp.reset,
                cursor: Number(rsp.cursor ?? 0),
                size: Number(rsp.size ?? 0),
            };
        }
        catch (err) {
            lastErr = err;
        }
    }
    if (lastErr)
        throw lastErr;
    return null;
}
async function extractViaFileTail(params) {
    const filePath = await readOpenclawLoggingFileFromConfig();
    const { lines, size } = await tailLinesFromFile(filePath, resolveExtractLimit(params));
    return {
        source: 'file.tail',
        file: filePath,
        lines,
        truncated: false,
        reset: false,
        cursor: size,
        size,
    };
}
async function extractLogs(params) {
    try {
        const logsTailResult = await extractViaLogsTail(params);
        if (logsTailResult)
            return logsTailResult;
    }
    catch (err) {
        log.warn('logs.tail 调用失败，降级到文件读取', { error: String(err) });
    }
    return extractViaFileTail(params);
}
function normalizeTs(ts) {
    if (ts < 1_000_000_000_000)
        return ts * 1000;
    return ts;
}
function parseLogTimestamp(line) {
    try {
        const obj = JSON.parse(line);
        const candidates = [obj['@timestamp'], obj._meta?.date, obj.timestamp, obj.ts];
        for (const c of candidates) {
            if (c === undefined || c === null)
                continue;
            if (typeof c === 'number')
                return normalizeTs(c);
            const num = Number(c);
            if (Number.isFinite(num) && `${c}`.trim() !== '')
                return normalizeTs(num);
            const dt = Date.parse(c);
            if (!Number.isNaN(dt))
                return dt;
        }
    }
    catch {
    }
    return undefined;
}
function resolveTimeRange(args) {
    if (args.startTime && args.endTime) {
        return {
            start: normalizeTs(args.startTime),
            end: normalizeTs(args.endTime),
        };
    }
    if (args.recentDays && args.recentDays > 0) {
        const end = Date.now();
        return {
            start: end - args.recentDays * 24 * 3600 * 1000,
            end,
        };
    }
    if (args.recentHours && args.recentHours > 0) {
        const end = Date.now();
        return {
            start: end - args.recentHours * 3600 * 1000,
            end,
        };
    }
    return undefined;
}
function filterLines(lines, args) {
    let next = lines;
    if (!args.all) {
        next = next.filter(line => /yuanbao/i.test(line));
    }
    const timeRange = resolveTimeRange(args);
    if (timeRange) {
        next = next.filter((line) => {
            const ts = parseLogTimestamp(line);
            if (!ts)
                return false;
            return ts >= timeRange.start && ts <= timeRange.end;
        });
    }
    if (next.length > args.limit) {
        next = next.slice(-args.limit);
    }
    return next;
}
export async function extractAndFilterLogs(args) {
    const extract = await extractLogs(args);
    const filteredLines = filterLines(extract.lines, args);
    return { extract, filteredLines };
}
