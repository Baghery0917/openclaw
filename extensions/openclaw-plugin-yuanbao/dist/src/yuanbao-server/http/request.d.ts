import type { ResolvedYuanbaoAccount } from '../../types.js';
export type SignTokenData = {
    bot_id: string;
    duration: number;
    product: string;
    source: string;
    token: string;
};
export type AuthHeaders = {
    'X-ID': string;
    'X-Token': string;
    'X-Source': string;
    'X-Route-Env'?: string;
    'X-AppVersion': string;
    'X-OperationSystem': string;
    'X-Instance-Id': string;
    'X-Bot-Version': string;
};
export type CosUploadConfig = {
    bucketName: string;
    region: string;
    location: string;
    encryptTmpSecretId: string;
    encryptTmpSecretKey: string;
    encryptToken: string;
    startTime: number;
    expiredTime: number;
    resourceUrl: string;
    resourceID?: string;
};
export type Log = {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
};
export declare const SIGN_TOKEN_PATH = "/api/v5/robotLogic/sign-token";
export declare const UPLOAD_INFO_PATH = "/api/resource/genUploadInfo";
export declare const DOWNLOAD_INFO_PATH = "/api/resource/v1/download";
export declare function clearSignTokenCache(accountId: string): void;
export declare function clearAllSignTokenCache(): void;
export declare function getTokenStatus(accountId: string): {
    status: 'valid' | 'expired' | 'refreshing' | 'none';
    expiresAt: number | null;
};
export declare function getCachedBotId(accountId: string): string | undefined;
export declare function verifySignature(expected: string, actual: string): boolean;
export declare function getSignToken(account: ResolvedYuanbaoAccount, log?: Log): Promise<SignTokenData>;
export declare function forceRefreshSignToken(account: ResolvedYuanbaoAccount, log?: Log): Promise<SignTokenData>;
export declare function getAuthHeaders(account: ResolvedYuanbaoAccount, log?: Log): Promise<AuthHeaders>;
export declare function yuanbaoPost<T>(account: ResolvedYuanbaoAccount, path: string, body: unknown, log?: Log): Promise<T>;
export declare function yuanbaoGet<T>(account: ResolvedYuanbaoAccount, path: string, params?: Record<string, string>, log?: Log): Promise<T>;
