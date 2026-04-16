/**
 * LightClaw — 媒体文件处理工具
 */
import type { FileAttachment, GatewayContext } from "./types.js";
export declare function parseDataUrl(dataUrl: string): {
    buffer: Buffer;
    mimeType: string;
} | null;
export declare function formatFileSize(bytes: number): string;
export declare function guessMimeByExt(ext: string): string;
export declare function mediaUrlsToFiles(urls: string[], log?: GatewayContext["log"]): Promise<FileAttachment[]>;
//# sourceMappingURL=media.d.ts.map