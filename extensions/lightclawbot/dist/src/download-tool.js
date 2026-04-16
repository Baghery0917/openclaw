/**
 * LightClaw — 文件下载工具
 *
 * 注册为 OpenClaw Agent Tool，允许 AI：
 * 1. 获取之前上传文件的公网下载链接
 * 2. 将云端文件下载到本地工作目录
 *
 * 工具名: lightclaw_get_file_url
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { getFileDownloadUrl, downloadFileFromCos, uploadFileToCos, } from "./file-storage.js";
import { formatFileSize } from "./media.js";
import { resolveEffectiveApiKey } from "./config.js";
// ============================================================
// 工具参数 schema
// ============================================================
export const DOWNLOAD_TOOL_NAME = "lightclaw_get_file_url";
export const downloadToolSchema = {
    type: "object",
    properties: {
        action: {
            type: "string",
            enum: ["get_url", "download_to_local", "upload_and_get_url"],
            description: "Action to perform: " +
                "'get_url' — get the public download URL for a previously uploaded file (by filePath); " +
                "'download_to_local' — download a cloud file to local directory; " +
                "'upload_and_get_url' — upload a local file and return its public download URL.",
        },
        filePath: {
            type: "string",
            description: "For 'get_url' and 'download_to_local': the cloud file path (e.g. '2026-03-06/report.pdf'). " +
                "For 'upload_and_get_url': the local file path to upload.",
        },
        localDir: {
            type: "string",
            description: "For 'download_to_local' only: the local directory to save the downloaded file. " +
                "Defaults to the current working directory if not specified.",
        },
    },
    required: ["action", "filePath"],
};
// ============================================================
// 工具注册（飞书工厂函数模式）
// ============================================================
export function registerDownloadTool(api) {
    // 通过闭包捕获 api.logger，tool ctx 中没有 log
    const log = api.logger;
    api.registerTool((ctx) => {
        const defaultAccountId = ctx.agentAccountId;
        const sessionKey = ctx.sessionKey;
        return {
            name: DOWNLOAD_TOOL_NAME,
            description: "Manage files on cloud storage. " +
                "Actions: " +
                "(1) 'get_url' — get a public download URL for a previously uploaded file (by its filePath); " +
                "(2) 'download_to_local' — download a cloud file back to the local filesystem for further processing; " +
                "(3) 'upload_and_get_url' — upload a single local file and return its public download URL. " +
                "Note: For batch uploading files to share with users, prefer lightclaw_upload_file instead.",
            parameters: downloadToolSchema,
            async execute(_toolCallId, params) {
                // 每次 execute 时动态解析 apiKey（多 key 模式下通过 sessionKey 直接获取）
                const apiKey = resolveEffectiveApiKey({ sessionKey });
                // log.warn(`[lightclaw_get_file_url] resolved apiKey="${apiKey?.slice(0, 8)}..."`);
                const { action, filePath, localDir } = params;
                if (!filePath || typeof filePath !== "string") {
                    return {
                        content: [{ type: "text", text: "Error: filePath is required." }],
                    };
                }
                try {
                    switch (action) {
                        case "get_url": {
                            const url = getFileDownloadUrl(filePath);
                            const fileName = filePath.split("/").pop() || filePath;
                            return {
                                content: [{ type: "text", text: `[${fileName}](${url})` }],
                                details: { action, filePath, url },
                            };
                        }
                        case "download_to_local": {
                            const result = await downloadFileFromCos(filePath, { apiKey });
                            const targetDir = localDir || process.cwd();
                            // 确保目录存在
                            if (!fs.existsSync(targetDir)) {
                                fs.mkdirSync(targetDir, { recursive: true });
                            }
                            const targetPath = path.join(targetDir, result.fileName);
                            fs.writeFileSync(targetPath, result.buffer);
                            return {
                                content: [{
                                        type: "text",
                                        text: `File downloaded to: ${targetPath} (${formatFileSize(result.buffer.length)}, ${result.contentType})`,
                                    }],
                                details: {
                                    action,
                                    filePath,
                                    localPath: targetPath,
                                    size: result.buffer.length,
                                    contentType: result.contentType,
                                },
                            };
                        }
                        case "upload_and_get_url": {
                            if (!fs.existsSync(filePath)) {
                                return {
                                    content: [{ type: "text", text: `Error: local file not found: ${filePath}` }],
                                };
                            }
                            const uploadResult = await uploadFileToCos(filePath, { apiKey });
                            const fileName = path.basename(filePath);
                            return {
                                content: [{
                                        type: "text",
                                        text: `File uploaded.\n\n[${fileName}](${uploadResult.url})`,
                                    }],
                                details: {
                                    action,
                                    localPath: filePath,
                                    cosFilePath: uploadResult.filePath,
                                    url: uploadResult.url,
                                },
                            };
                        }
                        default:
                            return {
                                content: [{
                                        type: "text",
                                        text: `Error: unknown action '${action}'. Use 'get_url', 'download_to_local', or 'upload_and_get_url'.`,
                                    }],
                            };
                    }
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    return {
                        content: [{ type: "text", text: `Error: ${errMsg}` }],
                    };
                }
            },
        };
    }, { name: DOWNLOAD_TOOL_NAME });
}
//# sourceMappingURL=download-tool.js.map