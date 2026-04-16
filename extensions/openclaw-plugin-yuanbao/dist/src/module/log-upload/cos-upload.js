import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { apiGetUploadInfo } from '../../yuanbao-server/api.js';
import { createLog } from '../../logger.js';
const DEFAULT_RECORD_API_URL = 'https://yuanbao.tencent.com/e/api/clawLogUpload';
function resolveRecordApiUrl(config) {
    const apiUrl = config?.logUploadApiUrl?.trim() || DEFAULT_RECORD_API_URL;
    if (!apiUrl) {
        throw new Error('缺少 logUploadApiUrl 配置或环境变量 YUANBAO_LOG_UPLOAD_API_URL');
    }
    return apiUrl;
}
const mlog = createLog('cos-upload');
function generateFileId() {
    return randomBytes(16).toString('hex');
}
async function uploadBufferToCos(config, data) {
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
    await cos.putObject({
        Bucket: config.bucketName,
        Region: config.region,
        Key: config.location,
        Body: data,
        Headers: { 'Content-Type': 'application/octet-stream' },
    });
    return config.resourceUrl;
}
async function recordViaApi(cosKey, cosUrl, args, account) {
    const { appKey, appSecret, apiDomain, routeEnv } = args;
    if (!appKey || !appSecret) {
        throw new Error('缺少 appKey 或 appSecret，无法校验凭证');
    }
    const apiUrl = resolveRecordApiUrl(account.config);
    mlog.info('发送 cosKey 到后端记录日志', { apiUrl, cosKey });
    const rsp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            appKey,
            appSecret,
            apiDomain: apiDomain || 'bot.yuanbao.tencent.com',
            routeEnv: routeEnv || '',
            cosKey,
            cosUrl,
            uin: args.uin || 'unknown',
            startTime: args.startTime,
            endTime: args.endTime,
            description: args.description || '',
        }),
    });
    if (!rsp.ok) {
        const errBody = await rsp.json().catch(() => ({}));
        const msg = errBody.error || `HTTP ${rsp.status}`;
        throw new Error(`日志记录失败: ${msg} (${apiUrl})`);
    }
    return await rsp.json();
}
export async function uploadToCos(gzipPath, args, account) {
    if (!args.uploadCos) {
        return { enabled: false };
    }
    const fileBuffer = await readFile(gzipPath);
    const fileName = basename(gzipPath);
    const fileId = generateFileId();
    mlog.info('通过 genUploadInfo 获取 COS 预签配置', { fileName, fileId });
    const cosConfig = await apiGetUploadInfo(account, fileName, fileId);
    mlog.info('开始上传到 COS', { bucket: cosConfig.bucketName, key: cosConfig.location });
    await uploadBufferToCos(cosConfig, fileBuffer);
    mlog.info('COS 上传完成', { cosKey: cosConfig.location, cosUrl: cosConfig.resourceUrl });
    const result = await recordViaApi(cosConfig.location, cosConfig.resourceUrl, args, account);
    if (!result.ok) {
        throw new Error(result.error || '日志记录失败');
    }
    return {
        enabled: true,
        cosPath: cosConfig.resourceUrl,
        cosUrl: cosConfig.resourceUrl,
        logId: result.logId,
        recordLogOk: result.recordOk,
    };
}
