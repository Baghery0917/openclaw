import type { ResolvedYuanbaoAccount } from '../../types.js';
import type { Log, CosUploadConfig } from './request.js';
export declare function apiGetUploadInfo(account: ResolvedYuanbaoAccount, fileName: string, fileId: string, log?: Log): Promise<CosUploadConfig>;
export declare function apiGetDownloadUrl(account: ResolvedYuanbaoAccount, resourceId: string, log?: Log): Promise<string>;
