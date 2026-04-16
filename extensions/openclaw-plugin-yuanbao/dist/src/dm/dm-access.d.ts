export interface DMAccessPolicy {
    allowedSenders: 'all' | 'admin' | 'allowlist';
    senderAllowlist?: string[];
    rateLimitPerHour: number;
    maxMessageLength: number;
}
export interface DMAccessResult {
    allowed: boolean;
    reason?: string;
}
export declare function recordDMSend(senderId: string): void;
export declare const DEFAULT_DM_ACCESS_POLICY: DMAccessPolicy;
export declare function enforceDMAccess(senderId: string, targetId: string, messageLength: number, policy?: DMAccessPolicy): DMAccessResult;
