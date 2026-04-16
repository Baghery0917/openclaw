import { yuanbaoPost, yuanbaoGet } from './request.js';
const UPLOAD_INFO_PATH = '/api/resource/genUploadInfo';
const DOWNLOAD_INFO_PATH = '/api/resource/v1/download';
export async function apiGetUploadInfo(account, fileName, fileId, log) {
    const data = await yuanbaoPost(account, UPLOAD_INFO_PATH, { fileName, fileId, docFrom: 'localDoc', docOpenId: '' }, log);
    if (!data.bucketName || !data.location) {
        throw new Error(`[yuanbao-api] genUploadInfo 配置不完整: ${JSON.stringify(data)}`);
    }
    return data;
}
export async function apiGetDownloadUrl(account, resourceId, log) {
    const data = await yuanbaoGet(account, DOWNLOAD_INFO_PATH, { resourceId }, log);
    const downloadUrl = data.url ?? data.realUrl;
    if (!downloadUrl) {
        throw new Error(`[yuanbao-api] resource/v1/download 未返回有效 URL: ${JSON.stringify(data)}`);
    }
    return downloadUrl;
}
