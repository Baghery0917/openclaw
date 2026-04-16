/**
 * LightClaw — 消息去重 & 节流 & ID 生成
 */
import { DEDUP_TTL, DEDUP_MAX_SIZE, HISTORY_THROTTLE_MS, HISTORY_THROTTLE_MAX_SIZE, } from "./config.js";
// ============================================================
// 消息去重
// ============================================================
const recentMessageIds = new Map();
export function isDuplicate(messageId) {
    const now = Date.now();
    if (recentMessageIds.size > DEDUP_MAX_SIZE) {
        for (const [id, ts] of recentMessageIds) {
            if (now - ts > DEDUP_TTL)
                recentMessageIds.delete(id);
        }
    }
    if (recentMessageIds.has(messageId))
        return true;
    recentMessageIds.set(messageId, now);
    return false;
}
// ============================================================
// History 请求防抖（per-user，高频请求只处理最后一条）
// ============================================================
/** userId → 防抖 timer */
const historyDebounceTimers = new Map();
/**
 * 对同一用户的 history 请求做防抖：
 * 在 HISTORY_THROTTLE_MS 窗口内如果有新请求到来，取消前一次，
 * 只在最后一次请求后延迟 HISTORY_THROTTLE_MS 再执行 callback。
 */
export function debounceHistoryRequest(userId, callback) {
    const existing = historyDebounceTimers.get(userId);
    if (existing)
        clearTimeout(existing);
    const timer = setTimeout(() => {
        historyDebounceTimers.delete(userId);
        callback();
    }, HISTORY_THROTTLE_MS);
    historyDebounceTimers.set(userId, timer);
    // 防止 Map 无限膨胀：清理过期条目
    if (historyDebounceTimers.size > HISTORY_THROTTLE_MAX_SIZE) {
        // timer 存在即未过期，但为安全起见限制总量
        const iter = historyDebounceTimers.keys();
        const oldest = iter.next().value;
        if (oldest && oldest !== userId) {
            const oldTimer = historyDebounceTimers.get(oldest);
            if (oldTimer)
                clearTimeout(oldTimer);
            historyDebounceTimers.delete(oldest);
        }
    }
}
// ============================================================
// 生成消息 ID
// ============================================================
let msgCounter = 0;
export function generateMsgId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    const seq = (msgCounter++).toString(36);
    return `${ts}-${rand}-${seq}`;
}
//# sourceMappingURL=dedup.js.map