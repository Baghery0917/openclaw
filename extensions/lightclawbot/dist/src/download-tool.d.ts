/**
 * LightClaw — 文件下载工具
 *
 * 注册为 OpenClaw Agent Tool，允许 AI：
 * 1. 获取之前上传文件的公网下载链接
 * 2. 将云端文件下载到本地工作目录
 *
 * 工具名: lightclaw_get_file_url
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
export declare const DOWNLOAD_TOOL_NAME = "lightclaw_get_file_url";
export declare const downloadToolSchema: {
    type: "object";
    properties: {
        action: {
            type: "string";
            enum: string[];
            description: string;
        };
        filePath: {
            type: "string";
            description: string;
        };
        localDir: {
            type: "string";
            description: string;
        };
    };
    required: readonly ["action", "filePath"];
};
export declare function registerDownloadTool(api: OpenClawPluginApi): void;
//# sourceMappingURL=download-tool.d.ts.map