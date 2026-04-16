/**
 * LightClaw — 消息去重 & 节流 & ID 生成
 */
export declare function isDuplicate(messageId: string): boolean;
/**
 * 对同一用户的 history 请求做防抖：
 * 在 HISTORY_THROTTLE_MS 窗口内如果有新请求到来，取消前一次，
 * 只在最后一次请求后延迟 HISTORY_THROTTLE_MS 再执行 callback。
 */
export declare function debounceHistoryRequest(userId: string, callback: () => void): void;
export declare function generateMsgId(): string;
//# sourceMappingURL=dedup.d.ts.map