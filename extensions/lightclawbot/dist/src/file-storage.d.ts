/**
 * LightClaw — 文件存储服务
 *
 * 通过远程 AI-Server 的文件管理接口实现文件的上传和下载，
 * 使得 openclaw 工作目录下的本地文件可以通过公网 URL 访问。
 *
 * 上传接口：POST https://lightai.cloud.tencent.com/drive/save
 * 下载接口：GET  https://lightai.cloud.tencent.com/drive/preview?filePath=xxx
 */
export interface FileStorageConfig {
    /** 认证 API Key（可选，用于服务端鉴权） */
    apiKey?: string;
}
export interface UploadResult {
    /** 文件的公网可访问 URL */
    url?: string;
    /** 云端存储的文件路径 */
    filePath?: string;
    /** 是否上传成功 */
    isUploaded: boolean;
}
export interface DownloadResult {
    /** 文件内容 Buffer */
    buffer: Buffer;
    /** 文件名 */
    fileName: string;
    /** MIME 类型 */
    contentType: string;
}
/**
 * 上传本地文件到云端存储
 *
 * @param localPath - 本地文件的绝对路径
 * @param config - 文件存储配置
 * @param customFileName - 自定义文件名（可选，默认使用原文件名）
 * @returns 上传结果，包含公网 URL
 */
export declare function uploadFileToCos(localPath: string, config?: FileStorageConfig, customFileName?: string): Promise<UploadResult>;
/**
 * 上传 Buffer 数据到云端存储
 *
 * @param buffer - 文件内容
 * @param fileName - 文件名
 * @param mimeType - MIME 类型
 * @param config - 文件存储配置
 * @returns 上传结果，包含公网 URL
 */
export declare function uploadBufferToCos(buffer: Buffer, fileName: string, mimeType: string, config?: FileStorageConfig): Promise<UploadResult>;
/**
 * 获取文件的公网下载 URL
 *
 * @param filePath - 云端文件路径（如 "2026-03-06/report.pdf"）
 * @param config - 文件存储配置
 * @returns 公网下载 URL
 */
export declare function getFileDownloadUrl(filePath: string): string;
/**
 * 从云端存储下载文件内容
 *
 * @param filePath - 云端文件路径
 * @param config - 文件存储配置
 * @returns 下载结果，包含 Buffer 和文件信息
 */
export declare function downloadFileFromCos(filePath: string, config?: FileStorageConfig): Promise<DownloadResult>;
/**
 * 上传本地文件并返回公网下载 URL
 * 这是一个便捷方法，组合了上传 + 获取 URL
 *
 * @param localPath - 本地文件路径
 * @param config - 文件存储配置
 * @returns 公网可访问的下载 URL
 */
export declare function uploadAndGetPublicUrl(localPath: string, config?: FileStorageConfig): Promise<string>;
//# sourceMappingURL=file-storage.d.ts.map