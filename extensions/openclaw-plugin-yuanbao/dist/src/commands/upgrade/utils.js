import { dirname } from 'node:path';
import { runPluginCommandWithTimeout } from 'openclaw/plugin-sdk/matrix';
import { createLog } from '../../logger.js';
const log = createLog('upgrade');
export const PLUGIN_ID = 'openclaw-plugin-yuanbao';
const EXEC_TIMEOUT_MS = 3 * 60 * 1000;
const PLUGIN_CMD_RETRY_MAX_ATTEMPTS = 5;
const PLUGIN_CMD_RETRY_DELAY_MS = 3000;
async function resolveNpmBin() {
    try {
        const result = await runPluginCommandWithTimeout({ argv: ['which', 'npm'], timeoutMs: 5000, env: makeEnv() });
        const resolved = result.stdout.trim();
        if (result.code === 0 && resolved)
            return resolved;
    }
    catch {
    }
    return 'npm';
}
async function resolveOpenClawBin() {
    try {
        const result = await runPluginCommandWithTimeout({ argv: ['which', 'openclaw'], timeoutMs: 5000, env: makeEnv() });
        const resolved = result.stdout.trim();
        if (result.code === 0 && resolved)
            return resolved;
    }
    catch {
    }
    return 'openclaw';
}
function makeEnv() {
    const nodeBinDir = dirname(process.execPath);
    const currentPath = process.env.PATH ?? '';
    return {
        ...process.env,
        PATH: currentPath.includes(nodeBinDir)
            ? currentPath
            : `${nodeBinDir}:${currentPath}`,
    };
}
function compareStableVersions(a, b) {
    const [aMaj, aMin, aPatch] = a.split('.').map(Number);
    const [bMaj, bMin, bPatch] = b.split('.').map(Number);
    return (aMaj - bMaj) || (aMin - bMin) || (aPatch - bPatch);
}
function isStableVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
}
export function isValidVersion(version) {
    return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function fetchLatestStableVersion() {
    const npmBin = await resolveNpmBin();
    log.debug('npm 路径', { npmBin, nodeExecPath: process.execPath });
    try {
        const regResult = await runPluginCommandWithTimeout({
            argv: [npmBin, 'config', 'get', 'registry'],
            timeoutMs: 5000,
            env: makeEnv(),
        });
        if (regResult.code === 0) {
            log.info('当前 npm registry', { registry: regResult.stdout.trim() });
        }
        else {
            log.warn('无法读取 npm registry 配置');
        }
    }
    catch {
        log.warn('无法读取 npm registry 配置');
    }
    log.info('查询 npm 最新正式版本', { package: PLUGIN_ID });
    try {
        const result = await runPluginCommandWithTimeout({
            argv: [npmBin, 'view', PLUGIN_ID, 'versions', '--json'],
            timeoutMs: EXEC_TIMEOUT_MS,
            env: makeEnv(),
        });
        if (result.code !== 0) {
            const stderr = result.stderr.trim() || undefined;
            log.error('npm view 执行失败', {
                summary: stderr?.split('\n')[0] ?? `exit code ${result.code}`,
                ...(stderr ? { stderr } : {}),
            });
            return null;
        }
        const raw = result.stdout;
        log.debug('npm view 输出', { raw });
        const parsed = JSON.parse(raw.trim());
        const allVersions = Array.isArray(parsed) ? parsed : [parsed];
        const stable = allVersions.filter(isStableVersion);
        log.info('npm 版本列表', { total: allVersions.length, stable: stable.length });
        if (stable.length === 0) {
            log.warn('npm 上未找到任何正式发布版本');
            return null;
        }
        const latest = stable.sort(compareStableVersions).at(-1) ?? null;
        log.info('获取到最新正式版本', { latestVersion: latest });
        return latest;
    }
    catch (e) {
        log.error('npm view 执行失败', { summary: firstLine(e) });
        return null;
    }
}
export async function isPublishedVersionOnNpm(version) {
    const npmBin = await resolveNpmBin();
    try {
        const result = await runPluginCommandWithTimeout({
            argv: [npmBin, 'view', `${PLUGIN_ID}@${version}`, 'version'],
            timeoutMs: 15_000,
            env: makeEnv(),
        });
        if (result.code !== 0) {
            log.warn('指定版本 npm 查询失败', {
                version,
                code: result.code,
                stderr: result.stderr.trim() || undefined,
            });
            return false;
        }
        const publishedVersion = result.stdout.trim();
        return publishedVersion === version;
    }
    catch (e) {
        log.warn('指定版本 npm 查询异常', { version, summary: firstLine(e) });
        return false;
    }
}
export async function readInstalledVersion(pluginId) {
    log.info('读取已安装版本', { pluginId });
    const result = await runOpenClawCommand(['plugins', 'list']);
    if (!result.ok) {
        log.warn('openclaw plugins list 执行失败', { summary: result.error, ...(result.stderr ? { stderr: result.stderr } : {}) });
        return null;
    }
    for (const line of (result.stdout ?? '').split('\n')) {
        if (line.toLowerCase().includes(pluginId.toLowerCase())) {
            const match = line.match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
            if (match) {
                log.info('已安装版本', { pluginId, version: match[1] });
                return match[1];
            }
        }
    }
    log.warn('未检测到已安装版本', { pluginId });
    return null;
}
export function snapshotYuanbaoChannelConfig(config) {
    const value = config.channels?.yuanbao;
    if (!value || typeof value !== 'object')
        return null;
    try {
        const snapshot = JSON.parse(JSON.stringify(value));
        return JSON.stringify(snapshot);
    }
    catch {
        return null;
    }
}
function isRateLimitPluginCommandError(result) {
    const combined = [result.error, result.stderr, result.stdout]
        .filter(Boolean)
        .join('\n');
    if (!combined)
        return false;
    return /rate limit exceeded/i.test(combined) || /\(429\)/.test(combined);
}
function firstLine(e) {
    if (e instanceof Error) {
        return e.message.split('\n')[0] ?? String(e);
    }
    return String(e).split('\n')[0];
}
export async function runOpenClawCommand(args, timeoutMs = EXEC_TIMEOUT_MS) {
    const openclawBin = await resolveOpenClawBin();
    const argv = [openclawBin, ...args];
    try {
        const result = await runPluginCommandWithTimeout({ argv, timeoutMs, env: makeEnv() });
        const stdout = result.stdout.trim() || undefined;
        const stderr = result.stderr.trim() || undefined;
        if (result.code !== 0) {
            const summary = stderr?.split('\n')[0] ?? stdout?.split('\n')[0] ?? `exit code ${result.code}`;
            return { ok: false, stdout, stderr, error: summary };
        }
        return { ok: true, stdout, stderr };
    }
    catch (e) {
        return { ok: false, error: firstLine(e) };
    }
}
export async function runOpenClawCommandWithRetry(params) {
    const { args, timeoutMs = EXEC_TIMEOUT_MS, commandName, onRetry } = params;
    let lastResult = { ok: false, error: 'unknown error' };
    for (let attempt = 1; attempt <= PLUGIN_CMD_RETRY_MAX_ATTEMPTS; attempt += 1) {
        lastResult = await runOpenClawCommand(args, timeoutMs);
        if (lastResult.ok)
            return lastResult;
        const retriable = isRateLimitPluginCommandError(lastResult);
        if (!retriable || attempt >= PLUGIN_CMD_RETRY_MAX_ATTEMPTS)
            break;
        const nextAttempt = attempt + 1;
        const retryDelayMs = PLUGIN_CMD_RETRY_DELAY_MS * attempt;
        log.warn('openclaw plugin 命令触发限频，准备重试', {
            commandName,
            attempt,
            nextAttempt,
            maxAttempts: PLUGIN_CMD_RETRY_MAX_ATTEMPTS,
            retryDelayMs,
            error: lastResult.error,
        });
        await onRetry?.({ nextAttempt, maxAttempts: PLUGIN_CMD_RETRY_MAX_ATTEMPTS });
        await sleep(retryDelayMs);
    }
    return lastResult;
}
