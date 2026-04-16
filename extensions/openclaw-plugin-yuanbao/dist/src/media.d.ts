import type { PluginRuntime } from 'openclaw/plugin-sdk';
import type { ResolvedYuanbaoAccount } from './types.js';
export type MediaUploadResult = {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    uuid: string;
    imageInfo?: {
        width: number;
        height: number;
    };
    resourceId?: string;
};
export type MediaFile = {
    filename: string;
    data: Buffer;
    mimeType: string;
};
export declare const IMAGE_EXTS: Set<string>;
export declare function guessMimeType(filename: string): string;
export declare function parseImageSize(buf: Buffer): {
    width: number;
    height: number;
} | undefined;
export declare function downloadMediaForYuanbao(url: string, maxMb?: number, account?: ResolvedYuanbaoAccount): Promise<MediaFile>;
export declare function uploadMediaToCos(mediaFile: MediaFile, account: ResolvedYuanbaoAccount, onProgress?: (percent: number) => void): Promise<MediaUploadResult>;
export declare function downloadAndUploadMedia(mediaUrl: string, core: PluginRuntime, account: ResolvedYuanbaoAccount, mediaLocalRoots?: string[], onProgress?: (percent: number) => void): Promise<MediaUploadResult>;
export declare function buildImageMsgBody(params: {
    url: string;
    filename?: string;
    size?: number;
    uuid?: string;
    imageInfo?: {
        width: number;
        height: number;
    };
}): Array<{
    msg_type: string;
    msg_content: Record<string, unknown>;
}>;
export declare function buildFileMsgBody(params: {
    url: string;
    filename: string;
    size?: number;
    uuid?: string;
}): Array<{
    msg_type: string;
    msg_content: Record<string, unknown>;
}>;
export declare function downloadMediasToLocalFiles(medias: Array<{
    url: string;
    mediaName?: string;
}>, account: ResolvedYuanbaoAccount, core: PluginRuntime, log: {
    verbose: (msg: string) => void;
    warn: (msg: string) => void;
}): Promise<{
    results: Array<{
        path: string;
        contentType: string;
    }>;
    mediaPaths: string[];
    mediaTypes: string[];
}>;
