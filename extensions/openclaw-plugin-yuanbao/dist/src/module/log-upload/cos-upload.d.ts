import type { CosUploadResult, ParsedCommandArgs } from './types.js';
import type { ResolvedYuanbaoAccount } from '../../types.js';
export declare function uploadToCos(gzipPath: string, args: ParsedCommandArgs, account: ResolvedYuanbaoAccount): Promise<CosUploadResult>;
