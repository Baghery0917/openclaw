export type DMError = {
    kind: 'user-not-found';
    detail: string;
} | {
    kind: 'dm-blocked';
    detail: string;
} | {
    kind: 'bot-not-started';
    detail: string;
} | {
    kind: 'rate-limited';
    retryAfter?: number;
} | {
    kind: 'text-too-long';
    detail: string;
    maxLength: number;
} | {
    kind: 'invalid-target';
    detail: string;
} | {
    kind: 'ws-unavailable';
    detail: string;
} | {
    kind: 'unknown';
    detail: string;
};
export declare function classifyError(err: unknown): DMError;
export declare function formatDMErrorForUser(error: DMError, targetDisplay: string): string;
