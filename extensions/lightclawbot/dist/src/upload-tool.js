/**
 * LightClaw — 文件上传工具
 *
 * 注册为 OpenClaw Agent Tool，允许 AI 将本地文件上传到云端存储，
 * 获得公网可访问的 URL，方便用户直接下载。
 *
 * 工具名: lightclaw_upload_file
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { uploadFileToCos } from "./file-storage.js";
import { formatFileSize } from "./media.js";
import { resolveEffectiveApiKey } from "./config.js";
// ============================================================
// 工具参数 schema（JSON Schema 格式）
// ============================================================
export const UPLOAD_TOOL_NAME = "lightclaw_upload_file";
export const uploadToolSchema = {
    type: "object",
    properties: {
        paths: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "需要上传的本地文件绝对路径数组，文件必须已写入磁盘，最多 5 个文件",
        },
    },
    required: ["paths"],
};
// ============================================================
// 工具注册（飞书工厂函数模式）
// ============================================================
export function registerUploadTool(api) {
    // 通过闭包捕获 api.logger，tool ctx 中没有 log
    const log = api.logger;
    api.registerTool((ctx) => {
        // 硬隔离：非 lightclawbot 通道时直接返回 null，框架不会暴露此工具
        if (ctx.messageChannel !== "lightclawbot") {
            // log.warn(`[lightclaw_upload_file] channel=${ctx.messageChannel}, skip..."`);
            return null;
        }
        const defaultAccountId = ctx.agentAccountId;
        const sessionKey = ctx.sessionKey;
        // log.warn(`[lightclaw_upload_file] channel=${ctx.messageChannel}, contiue..."`);
        return {
            name: UPLOAD_TOOL_NAME,
            description: "将本地文件上传到云端临时存储并返回下载链接。" +
                "当需要把生成的文件（图片、文档、代码包等）交付给用户时，必须使用此工具。" +
                "文件必须先写入磁盘，然后传入绝对路径。单次最多 5 个文件，超出请分批调用。",
            parameters: uploadToolSchema,
            async execute(_toolCallId, params) {
                // 每次 execute 时动态解析 apiKey（多 key 模式下通过 sessionKey 直接获取）
                const apiKey = resolveEffectiveApiKey({ sessionKey });
                // log.warn(`[lightclaw_upload_file] resolved apiKey="${apiKey?.slice(0, 8)}..."`);
                const { paths } = params;
                // 参数校验
                if (!Array.isArray(paths) || paths.length === 0) {
                    return {
                        content: [{ type: "text", text: "Error: paths must be a non-empty array of file paths." }],
                    };
                }
                if (paths.length > 5) {
                    return {
                        content: [{ type: "text", text: "Error: maximum 5 files per upload." }],
                    };
                }
                // 验证所有文件存在
                const validationErrors = [];
                for (const p of paths) {
                    if (typeof p !== "string" || !p.trim()) {
                        validationErrors.push(`Invalid path: empty or non-string`);
                        continue;
                    }
                    if (!fs.existsSync(p)) {
                        validationErrors.push(`File not found: ${p}`);
                        continue;
                    }
                    const stat = fs.statSync(p);
                    if (!stat.isFile()) {
                        validationErrors.push(`Not a regular file: ${p}`);
                    }
                }
                if (validationErrors.length > 0) {
                    return {
                        content: [{ type: "text", text: `Validation errors:\n${validationErrors.join("\n")}` }],
                    };
                }
                // 并发上传（最多 3 个并发）
                const results = [];
                const concurrency = 3;
                for (let i = 0; i < paths.length; i += concurrency) {
                    const batch = paths.slice(i, i + concurrency);
                    const batchResults = await Promise.allSettled(batch.map(async (filePath) => {
                        const stat = fs.statSync(filePath);
                        const uploadResult = await uploadFileToCos(filePath, { apiKey });
                        return {
                            path: filePath,
                            success: true,
                            url: uploadResult.url,
                            filePath: uploadResult.filePath,
                            size: formatFileSize(stat.size),
                        };
                    }));
                    for (let j = 0; j < batchResults.length; j++) {
                        const r = batchResults[j];
                        if (r.status === "fulfilled") {
                            results.push(r.value);
                        }
                        else {
                            results.push({
                                path: batch[j],
                                success: false,
                                error: r.reason instanceof Error ? r.reason.message : String(r.reason),
                            });
                        }
                    }
                }
                // 构建结果文本（使用 Markdown 链接格式，引导模型原样输出给用户）
                const lines = [];
                const successResults = [];
                for (const r of results) {
                    const name = path.basename(r.path);
                    if (r.success && r.url) {
                        lines.push(`✅ [${name}](${r.url}) (${r.size})`);
                        successResults.push({ name, url: r.url, size: r.size });
                    }
                    else {
                        lines.push(`❌ ${name}: ${r.error}`);
                    }
                }
                const summary = results.length === 1
                    ? successResults.length === 1
                        ? `File uploaded successfully.\n\n[${successResults[0].name}](${successResults[0].url})`
                        : `File upload failed: ${results[0].error}`
                    : `Uploaded ${successResults.length}/${results.length} files.\n${lines.join("\n")}`;
                return {
                    content: [{ type: "text", text: summary }],
                    details: { uploads: results },
                };
            },
        };
    }, { name: UPLOAD_TOOL_NAME });
}
//# sourceMappingURL=upload-tool.js.map