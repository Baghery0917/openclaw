import type { MessageHandlerContext } from './context.js';
import type { MsgBodyItemType, ExtractTextFromMsgBodyResult } from './handlers/types.js';
export type { ExtractTextFromMsgBodyResult } from './handlers/types.js';
export declare function extractTextFromMsgBody(ctx: MessageHandlerContext, msgBody?: Array<MsgBodyItemType>): ExtractTextFromMsgBodyResult;
