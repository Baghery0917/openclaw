/**
 * LightClaw — 文件上传工具
 *
 * 注册为 OpenClaw Agent Tool，允许 AI 将本地文件上传到云端存储，
 * 获得公网可访问的 URL，方便用户直接下载。
 *
 * 工具名: lightclaw_upload_file
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
export declare const UPLOAD_TOOL_NAME = "lightclaw_upload_file";
export declare const uploadToolSchema: {
    type: "object";
    properties: {
        paths: {
            type: "array";
            items: {
                type: "string";
            };
            minItems: number;
            maxItems: number;
            description: string;
        };
    };
    required: readonly ["paths"];
};
export declare function registerUploadTool(api: OpenClawPluginApi): void;
//# sourceMappingURL=upload-tool.d.ts.map