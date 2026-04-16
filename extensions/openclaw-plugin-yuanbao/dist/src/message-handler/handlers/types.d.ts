import type { MessageHandlerContext } from '../context.js';
export type MsgBodyItemType = {
    msg_type: string;
    msg_content: {
        text?: string;
        uuid?: string;
        image_format?: number;
        data?: string;
        desc?: string;
        ext?: string;
        sound?: string;
        image_info_array?: Array<{
            type?: number;
            size?: number;
            width?: number;
            height?: number;
            url?: string;
        }>;
        index?: number;
        url?: string;
        file_size?: number;
        file_name?: string;
        [key: string]: unknown;
    };
};
export type MediaItem = {
    mediaType: 'image' | 'file';
    url: string;
    mediaName?: string;
};
export type MentionItem = {
    userId: string;
    text: string;
};
export type ExtractTextFromMsgBodyResult = {
    rawBody: string;
    isAtBot: boolean;
    medias: MediaItem[];
    mentions: MentionItem[];
};
export type OutboundContentItem = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    url: string;
    uuid?: string;
    imageFormat?: number;
    imageInfoArray?: Array<{
        type?: number;
        size?: number;
        width?: number;
        height?: number;
        url?: string;
    }>;
} | {
    type: 'file';
    url: string;
    fileName?: string;
    fileSize?: number;
    uuid?: string;
} | {
    type: 'video';
    videoUrl: string;
    [key: string]: unknown;
} | {
    type: 'custom';
    data: string | Record<string, unknown>;
};
export interface MessageElemHandler {
    readonly msgType: string;
    extract(ctx: MessageHandlerContext, elem: MsgBodyItemType, resData: ExtractTextFromMsgBodyResult): string | undefined;
    buildMsgBody?(data: Record<string, unknown>): MsgBodyItemType[];
}
