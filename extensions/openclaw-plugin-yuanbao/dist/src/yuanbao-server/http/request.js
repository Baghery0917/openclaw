import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createLog } from '../../logger.js';
import { getOpenclawVersion, getOperationSystem, getPluginVersion } from '../../utils/get-env.js';
export const SIGN_TOKEN_PATH = '/api/v5/robotLogic/sign-token';
export const UPLOAD_INFO_PATH = '/api/resource/genUploadInfo';
export const DOWNLOAD_INFO_PATH = '/api/resource/v1/download';
const RETRYABLE_SIGN_CODE = 10099;
const SIGN_MAX_RETRIES = 3;
const SIGN_RETRY_DELAY_MS = 1000;
const CACHE_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const MAX_SAFE_TIMEOUT_MS = 24 * 24 * 3600 * 1000;
const HTTP_AUTH_RETRY_MAX = 1;
const tokenCacheMap = new Map();
const tokenFetchPromises = new Map();
const tokenRefreshTimers = new Map();
export function clearSignTokenCache(accountId) {
    tokenCacheMap.delete(accountId);
    const timer = tokenRefreshTimers.get(accountId);
    if (timer) {
        clearTimeout(timer);
        tokenRefreshTimers.delete(accountId);
    }
}
export function clearAllSignTokenCache() {
    tokenCacheMap.clear();
    for (const timer of tokenRefreshTimers.values()) {
        clearTimeout(timer);
    }
    tokenRefreshTimers.clear();
}
export function getTokenStatus(accountId) {
    if (tokenFetchPromises.has(accountId)) {
        return { status: 'refreshing', expiresAt: tokenCacheMap.get(accountId)?.expiresAt ?? null };
    }
    const cached = tokenCacheMap.get(accountId);
    if (!cached)
        return { status: 'none', expiresAt: null };
    return {
        status: cached.expiresAt > Date.now() ? 'valid' : 'expired',
        expiresAt: cached.expiresAt,
    };
}
export function getCachedBotId(accountId) {
    const cached = tokenCacheMap.get(accountId);
    if (!cached || cached.expiresAt <= Date.now())
        return undefined;
    return cached.data.bot_id || undefined;
}
function computeSignature(params) {
    const plain = params.nonce + params.timestamp + params.appKey + params.appSecret;
    return createHmac('sha256', params.appSecret).update(plain)
        .digest('hex');
}
export function verifySignature(expected, actual) {
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(actual, 'hex');
    if (expectedBuf.length !== actualBuf.length) {
        return false;
    }
    return timingSafeEqual(expectedBuf, actualBuf);
}
async function doFetchSignToken(account, log) {
    const mlog = createLog('http', log);
    const { appKey, appSecret, apiDomain } = account;
    if (!appKey || !appSecret)
        throw new Error('签票失败: 缺少 appKey 或 appSecret');
    const url = `https://${apiDomain}${SIGN_TOKEN_PATH}`;
    for (let attempt = 0; attempt <= SIGN_MAX_RETRIES; attempt++) {
        const nonce = randomBytes(16).toString('hex');
        const bjTime = new Date(Date.now() + 8 * 3600000);
        const timestamp = bjTime.toISOString().replace('Z', '+08:00')
            .replace(/\.\d{3}/, '');
        const signature = computeSignature({ nonce, timestamp, appKey, appSecret });
        const body = { app_key: appKey, nonce, signature, timestamp };
        mlog.info(`正在签票: url=${url}${attempt > 0 ? ` (重试 ${attempt}/${SIGN_MAX_RETRIES})` : ''}`);
        mlog.info('签票入参', body);
        const headers = {
            'Content-Type': 'application/json',
            'X-AppVersion': getPluginVersion(),
            'X-OperationSystem': getOperationSystem(),
            'X-Instance-Id': '16',
            'X-Bot-Version': getOpenclawVersion(),
        };
        if (account.config?.routeEnv) {
            headers['x-route-env'] = account.config.routeEnv;
        }
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`签票请求失败: HTTP ${response.status} ${response.statusText}`);
        }
        const result = (await response.json());
        if (result.code === 0) {
            mlog.info(`签票成功: bot_id=${result.data.bot_id}`);
            return result.data;
        }
        if (result.code === RETRYABLE_SIGN_CODE && attempt < SIGN_MAX_RETRIES) {
            mlog.warn(`签票可重试: code=${result.code}, 将在 ${SIGN_RETRY_DELAY_MS}ms 后重试`);
            await new Promise(r => setTimeout(r, SIGN_RETRY_DELAY_MS));
            continue;
        }
        throw new Error(`签票错误: code=${result.code}, msg=${result.msg}`);
    }
    throw new Error('签票失败: 超过最大重试次数');
}
function scheduleTokenRefresh(account, durationSec, log) {
    const mlog = createLog('http', log);
    const existing = tokenRefreshTimers.get(account.accountId);
    if (existing) {
        clearTimeout(existing);
    }
    const rawMs = durationSec * 1000 - CACHE_REFRESH_MARGIN_MS;
    const refreshAfterMs = Math.min(Math.max(rawMs, 60_000), MAX_SAFE_TIMEOUT_MS);
    const clampedHint = rawMs > MAX_SAFE_TIMEOUT_MS ? ', clamped to max safe timeout' : '';
    mlog.info(`[${account.accountId}][token-timer] 已安排定时刷新: `
        + `${Math.round(refreshAfterMs / 1000)}s 后 (duration=${durationSec}s, `
        + `margin=${CACHE_REFRESH_MARGIN_MS / 1000}s${clampedHint})`);
    const timer = setTimeout(async () => {
        tokenRefreshTimers.delete(account.accountId);
        try {
            mlog.info(`[${account.accountId}][token-timer]定时刷新触发，开始重新签票`);
            await forceRefreshSignToken(account, log);
            mlog.info(`[${account.accountId}][token-timer]定时刷新完成`);
        }
        catch (err) {
            mlog.error(`[${account.accountId}][token-timer]定时刷新失败: ${String(err)}，30s 后重试`);
            const retryTimer = setTimeout(async () => {
                tokenRefreshTimers.delete(account.accountId);
                try {
                    await forceRefreshSignToken(account, log);
                    mlog.info(`[${account.accountId}][token-timer]定时刷新重试成功`);
                }
                catch (retryErr) {
                    mlog.error(`[${account.accountId}][token-timer]定时刷新重试也失败: ${String(retryErr)}，等待下次请求触发刷新`);
                }
            }, 30_000);
            tokenRefreshTimers.set(account.accountId, retryTimer);
        }
    }, refreshAfterMs);
    tokenRefreshTimers.set(account.accountId, timer);
}
export async function getSignToken(account, log) {
    if (account.token) {
        return {
            bot_id: account.botId || '',
            duration: 0,
            product: 'yuanbao',
            source: 'bot',
            token: account.token,
        };
    }
    const tlog = createLog('http', log);
    const cached = tokenCacheMap.get(account.accountId);
    if (cached && cached.expiresAt > Date.now()) {
        const remainSec = Math.round((cached.expiresAt - Date.now()) / 1000);
        tlog.info(`[${account.accountId}]使用缓存 token (剩余 ${remainSec}s)`);
        return cached.data;
    }
    let fetchPromise = tokenFetchPromises.get(account.accountId);
    if (fetchPromise) {
        tlog.info(`[${account.accountId}]签票进行中，等待已有请求`);
        return fetchPromise;
    }
    fetchPromise = (async () => {
        try {
            const data = await doFetchSignToken(account, log);
            const ttlMs = data.duration > 0 ? data.duration * 1000 : 0;
            if (ttlMs > 0) {
                tokenCacheMap.set(account.accountId, { data, expiresAt: Date.now() + ttlMs });
                scheduleTokenRefresh(account, data.duration, log);
            }
            return data;
        }
        finally {
            tokenFetchPromises.delete(account.accountId);
        }
    })();
    tokenFetchPromises.set(account.accountId, fetchPromise);
    return fetchPromise;
}
export async function forceRefreshSignToken(account, log) {
    const flog = createLog('http', log);
    flog.warn(`[${account.accountId}][force-refresh]清除缓存并重新签票`);
    clearSignTokenCache(account.accountId);
    tokenFetchPromises.delete(account.accountId);
    return getSignToken(account, log);
}
export async function getAuthHeaders(account, log) {
    const data = await getSignToken(account, log);
    if (data.bot_id && !account.botId) {
        account.botId = data.bot_id;
    }
    const authHeaders = {
        'X-ID': data.bot_id || account.botId || '',
        'X-Token': data.token,
        'X-Source': data.source || 'web',
        'X-AppVersion': getPluginVersion(),
        'X-OperationSystem': getOperationSystem(),
        'X-Instance-Id': '16',
        'X-Bot-Version': getOpenclawVersion(),
    };
    if (account.config?.routeEnv) {
        authHeaders['X-Route-Env'] = account.config.routeEnv;
    }
    return authHeaders;
}
export async function yuanbaoPost(account, path, body, log) {
    const plog = createLog('http', log);
    const url = `https://${account.apiDomain}${path}`;
    for (let attempt = 0; attempt <= HTTP_AUTH_RETRY_MAX; attempt++) {
        const authHeaders = await getAuthHeaders(account, log);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
            },
            body: JSON.stringify(body),
        });
        if (response.status === 401 && attempt < HTTP_AUTH_RETRY_MAX) {
            plog.warn(`[post][${account.accountId}] ${path} 收到 401，刷新 token 后重试 (attempt=${attempt + 1})`);
            await forceRefreshSignToken(account, log);
            continue;
        }
        if (!response.ok) {
            throw new Error(`[yuanbao-api][POST] ${path} HTTP ${response.status} ${response.statusText}`);
        }
        const json = (await response.json());
        if (json.code !== 0 && json.code !== undefined) {
            throw new Error(`[yuanbao-api][POST] ${path} 业务错误: code=${json.code}, msg=${json.msg}`);
        }
        plog.info(`[post][${account.accountId}] ${path} 请求成功`);
        return (json.data ?? json);
    }
    throw new Error(`[yuanbao-api][POST] ${path} 401 重试次数已耗尽`);
}
export async function yuanbaoGet(account, path, params, log) {
    const glog = createLog('http', log);
    const url = `https://${account.apiDomain}${path}${params ? `?${new URLSearchParams(params).toString()}` : ''}`;
    for (let attempt = 0; attempt <= HTTP_AUTH_RETRY_MAX; attempt++) {
        const authHeaders = await getAuthHeaders(account, log);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
            },
        });
        if (response.status === 401 && attempt < HTTP_AUTH_RETRY_MAX) {
            glog.warn(`[get][${account.accountId}] ${path} 收到 401，刷新 token 后重试 (attempt=${attempt + 1})`);
            await forceRefreshSignToken(account, log);
            continue;
        }
        if (!response.ok) {
            throw new Error(`[yuanbao-api][GET] ${path} HTTP ${response.status} ${response.statusText}`);
        }
        const json = (await response.json());
        if (json.code !== 0 && json.code !== undefined) {
            throw new Error(`[yuanbao-api][GET] ${path} 业务错误: code=${json.code}, msg=${json.msg}`);
        }
        return (json.data ?? json);
    }
    throw new Error(`[yuanbao-api][GET] ${path} 401 重试次数已耗尽`);
}
