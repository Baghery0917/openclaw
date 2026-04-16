/**
 * LightClaw — Session Reader
 *
 * 核心的历史消息读取逻辑，包含：
 *   - readSessionHistory()          — 读取单个 session 的历史消息
 *   - readSessionHistoryTail()      — 从文件末尾高效读取（大文件优化）
 *   - readCronHistory()             — 读取指定 cron job 的全部运行历史
 *   - readSessionHistoryWithCron()  — 【方案C核心】主会话 + cron 消息按时间线混合
 *   - listSessions()                — 列出所有 session（含 cron 类型标识）
 */
import type { HistoryMessage, ReadHistoryOptions, ReadHistoryTailOptions, ReadHistoryWithCronOptions, SessionListEntry } from "./types.js";
/**
 * 读取指定 sessionKey 的历史对话消息
 *
 * @param sessionKey - 会话标识（与 gateway.ts 中 route.sessionKey 一致）
 * @param opts - 选项
 * @returns 历史消息数组（按时间正序），如果找不到 session 返回空数组
 */
export declare function readSessionHistory(sessionKey: string, opts?: ReadHistoryOptions): HistoryMessage[];
/**
 * 读取指定 sessionKey 的历史消息（从文件末尾读取，大文件性能更好）
 *
 * 对于大文件（>maxBytes），不读取整个文件，而是从末尾读取指定字节数。
 */
export declare function readSessionHistoryTail(sessionKey: string, opts?: ReadHistoryTailOptions): HistoryMessage[];
/**
 * 读取指定 cron job 的所有运行历史（跨多个 run session）
 *
 * @param cronJobId - cron job UUID
 * @param opts - 选项
 * @returns 按时间正序排列的所有运行消息（仅 user + assistant）
 */
export declare function readCronHistory(cronJobId: string, opts?: ReadHistoryOptions): HistoryMessage[];
/**
 * 读取主会话历史 + 关联的 cron 消息，按时间线合并
 *
 * 关联机制（精确关联，非遍历全量）：
 *   1. 读取主会话 JSONL → 解析消息 + 同时扫描 cron 工具调用结果
 *   2. 从 cron toolResult 中提取 cron job IDs（显式关联）
 *   3. 用这些 job IDs 到 sessions.json 中精确匹配 cron run sessions
 *   4. 读取关联的 cron run sessions 的消息
 *   5. 按时间窗口过滤 + 合并排序
 *
 * 相比旧方案（遍历所有 cron sessions + 时间窗口近似匹配），
 * 新方案通过主会话中的 cron 工具调用记录建立了**显式关联关系**。
 *
 * @param sessionKey - 主会话标识
 * @param opts - 选项（可控制是否包含 cron、筛选特定 cron job）
 * @returns 按时间正序排列的合并消息
 */
export declare function readSessionHistoryWithCron(sessionKey: string, opts?: ReadHistoryWithCronOptions): HistoryMessage[];
/**
 * 列出所有已知的 session（从 sessions.json 索引读取）
 *
 * 增强：每个条目标识会话类型（direct / cron-base / cron-run）
 */
export declare function listSessions(agentId?: string): SessionListEntry[];
//# sourceMappingURL=session-reader.d.ts.map