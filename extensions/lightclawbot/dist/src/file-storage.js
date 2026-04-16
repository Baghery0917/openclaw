/**
 * LightClaw — 文件存储服务
 *
 * 通过远程 AI-Server 的文件管理接口实现文件的上传和下载，
 * 使得 openclaw 工作目录下的本地文件可以通过公网 URL 访问。
 *
 * 上传接口：POST https://lightai.cloud.tencent.com/drive/save
 * 下载接口：GET  https://lightai.cloud.tencent.com/drive/preview?filePath=xxx
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { guessMimeByExt } from "./media.js";
import { COS_BASE_URL, API_PATH_UPLOAD, API_PATH_DOWNLOAD, UPLOAD_TIMEOUT, buildAuthHeaders, } from "./config.js";
// ============================================================
// 核心方法
// ============================================================
/**
 * 上传本地文件到云端存储
 *
 * @param localPath - 本地文件的绝对路径
 * @param config - 文件存储配置
 * @param customFileName - 自定义文件名（可选，默认使用原文件名）
 * @returns 上传结果，包含公网 URL
 */
export async function uploadFileToCos(localPath, config = {}, customFileName) {
    // 验证文件存在
    if (!fs.existsSync(localPath)) {
        throw new Error(`File not found: ${localPath}`);
    }
    const stat = fs.statSync(localPath);
    if (!stat.isFile()) {
        throw new Error(`Not a regular file: ${localPath}`);
    }
    const fileName = customFileName || path.basename(localPath);
    const fileBuffer = fs.readFileSync(localPath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = guessMimeByExt(ext);
    // 时间戳目录 + 原始文件名，天然唯一且简洁
    const filePath = `${Date.now()}/${fileName}`;
    // 使用 fetch + FormData 上传
    const { Blob: NodeBlob } = await import("node:buffer");
    const blob = new NodeBlob([fileBuffer], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("filePath", filePath);
    const headers = buildAuthHeaders(config.apiKey ?? "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
    try {
        const response = await fetch(`${COS_BASE_URL}${API_PATH_UPLOAD}`, {
            method: "POST",
            body: formData,
            headers,
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Upload failed (HTTP ${response.status}): ${text}`);
        }
        const result = (await response.json());
        if (result.code === 0 && result.data?.uploaded) {
            return { url: `${COS_BASE_URL}${API_PATH_DOWNLOAD}?filePath=${filePath}`, filePath, isUploaded: true };
        }
        throw new Error(`Upload failed (HTTP ${response.status}): ${result.data}`);
    }
    finally {
        clearTimeout(timeoutId);
    }
}
/**
 * 上传 Buffer 数据到云端存储
 *
 * @param buffer - 文件内容
 * @param fileName - 文件名
 * @param mimeType - MIME 类型
 * @param config - 文件存储配置
 * @returns 上传结果，包含公网 URL
 */
export async function uploadBufferToCos(buffer, fileName, mimeType, config = {}) {
    const filePath = `${Date.now()}/${fileName}`;
    const { Blob: NodeBlob } = await import("node:buffer");
    const blob = new NodeBlob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("filePath", filePath);
    const headers = buildAuthHeaders(config.apiKey ?? "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
    try {
        const response = await fetch(`${COS_BASE_URL}${API_PATH_UPLOAD}`, {
            method: "POST",
            body: formData,
            headers,
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Upload failed (HTTP ${response.status}): ${text}`);
        }
        const result = (await response.json());
        if (result.code === 0 && result.data?.uploaded) {
            return { url: `${COS_BASE_URL}${API_PATH_DOWNLOAD}?filePath=${filePath}`, filePath, isUploaded: true };
        }
        throw new Error(`Upload failed (HTTP ${response.status}): ${result.data}`);
    }
    finally {
        clearTimeout(timeoutId);
    }
}
/**
 * 获取文件的公网下载 URL
 *
 * @param filePath - 云端文件路径（如 "2026-03-06/report.pdf"）
 * @param config - 文件存储配置
 * @returns 公网下载 URL
 */
export function getFileDownloadUrl(filePath) {
    return `${COS_BASE_URL}${API_PATH_DOWNLOAD}?filePath=${encodeURIComponent(filePath)}`;
}
/**
 * 从云端存储下载文件内容
 *
 * @param filePath - 云端文件路径
 * @param config - 文件存储配置
 * @returns 下载结果，包含 Buffer 和文件信息
 */
export async function downloadFileFromCos(filePath, config = {}) {
    const url = filePath.startsWith("http") ? filePath : `${COS_BASE_URL}${API_PATH_DOWNLOAD}?filePath=${encodeURIComponent(filePath)}`;
    const headers = buildAuthHeaders(config.apiKey ?? "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
    try {
        const response = await fetch(url, { headers, signal: controller.signal });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Download failed (HTTP ${response.status}): ${text}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const fileName = filePath.split("/").pop() || "file";
        return { buffer, fileName, contentType };
    }
    finally {
        clearTimeout(timeoutId);
    }
}
/**
 * 上传本地文件并返回公网下载 URL
 * 这是一个便捷方法，组合了上传 + 获取 URL
 *
 * @param localPath - 本地文件路径
 * @param config - 文件存储配置
 * @returns 公网可访问的下载 URL
 */
export async function uploadAndGetPublicUrl(localPath, config = {}) {
    const result = await uploadFileToCos(localPath, config);
    return result.url || '';
}
//# sourceMappingURL=file-storage.js.map