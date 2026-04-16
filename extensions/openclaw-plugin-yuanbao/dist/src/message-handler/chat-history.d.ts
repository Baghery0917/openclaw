import type { HistoryEntry } from 'openclaw/plugin-sdk/mattermost';
export type GroupHistoryEntry = HistoryEntry & {
    medias?: Array<{
        url: string;
        mediaName?: string;
    }>;
};
export type MediaHistoryEntry = {
    sender: string;
    messageId?: string;
    timestamp: number;
    medias: Array<{
        url: string;
        mediaName?: string;
    }>;
};
export declare const chatHistories: Map<string, GroupHistoryEntry[]>;
export declare const chatMediaHistories: Map<string, MediaHistoryEntry[]>;
export declare function recordMediaHistory(groupCode: string, entry: MediaHistoryEntry): void;
