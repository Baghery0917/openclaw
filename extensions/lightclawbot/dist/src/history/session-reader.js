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
import fs from "node:fs";
import { resolveTranscriptPath } from "./session-store.js";
import { isSystemInjectedUserMessage, normalizeMessage } from "./message-parser.js";
import { listCronSessions, classifySessionKey, extractCronJobId, extractCronJobIdsFromTranscript, findCronSessionsByJobIds, } from "./cron-utils.js";
import { loadSessionStore } from "./session-store.js";
// ============================================================
// 核心读取：单个 Session
// ============================================================
/**
 * 读取指定 sessionKey 的历史对话消息
 *
 * @param sessionKey - 会话标识（与 gateway.ts 中 route.sessionKey 一致）
 * @param opts - 选项
 * @returns 历史消息数组（按时间正序），如果找不到 session 返回空数组
 */
export function readSessionHistory(sessionKey, opts) {
    const limit = opts?.limit ?? 200;
    const chatOnly = opts?.chatOnly ?? false;
    const filePath = resolveTranscriptPath(sessionKey, opts?.agentId);
    if (!filePath)
        return [];
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        return parseTranscriptLines(raw, { limit, chatOnly });
    }
    catch {
        return [];
    }
}
/**
 * 读取指定 sessionKey 的历史消息（从文件末尾读取，大文件性能更好）
 *
 * 对于大文件（>maxBytes），不读取整个文件，而是从末尾读取指定字节数。
 */
export function readSessionHistoryTail(sessionKey, opts) {
    const limit = opts?.limit ?? 200;
    const chatOnly = opts?.chatOnly ?? false;
    const maxBytes = opts?.maxBytes ?? 1_048_576; // 默认 1MB
    const filePath = resolveTranscriptPath(sessionKey, opts?.agentId);
    if (!filePath)
        return [];
    let fd = null;
    try {
        fd = fs.openSync(filePath, "r");
        const stat = fs.fstatSync(fd);
        const size = stat.size;
        if (size === 0)
            return [];
        // 小文件直接全量读取
        if (size <= maxBytes) {
            fs.closeSync(fd);
            fd = null;
            return readSessionHistory(sessionKey, opts);
        }
        // 大文件从末尾读取
        const readStart = Math.max(0, size - maxBytes);
        const readLen = Math.min(size, maxBytes);
        const buf = Buffer.alloc(readLen);
        fs.readSync(fd, buf, 0, readLen, readStart);
        const chunk = buf.toString("utf-8");
        const lines = chunk.split(/\r?\n/).filter((l) => l.trim());
        // 跳过第一行（可能是不完整的行）
        if (readStart > 0 && lines.length > 0) {
            lines.shift();
        }
        return parseLines(lines, { limit, chatOnly });
    }
    catch {
        return [];
    }
    finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            }
            catch { /* ignore */ }
        }
    }
}
// ============================================================
// Cron 历史读取
// ============================================================
/**
 * 读取指定 cron job 的所有运行历史（跨多个 run session）
 *
 * @param cronJobId - cron job UUID
 * @param opts - 选项
 * @returns 按时间正序排列的所有运行消息（仅 user + assistant）
 */
export function readCronHistory(cronJobId, opts) {
    const limit = opts?.limit ?? 200;
    const cronSessions = listCronSessions(opts?.agentId)
        .filter((s) => s.cronJobId === cronJobId)
        .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0)); // 时间正序
    const allMessages = [];
    for (const cs of cronSessions) {
        const messages = readSessionHistory(cs.sessionKey, {
            ...opts,
            limit: limit - allMessages.length,
            chatOnly: true,
        });
        for (const msg of messages) {
            // cron run 的 user 消息是系统自动生成的 prompt 模板，不是用户真实输入，跳过
            if (msg.role === "user")
                continue;
            msg.cronInfo = {
                jobId: cs.cronJobId,
                name: cs.cronName,
                runSessionId: cs.sessionId,
            };
            allMessages.push(msg);
        }
        if (allMessages.length >= limit)
            break;
    }
    return allMessages.slice(-limit);
}
// ============================================================
// 核心：混合读取（基于显式关联）
// ============================================================
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
export function readSessionHistoryWithCron(sessionKey, opts) {
    const limit = opts?.limit ?? 200;
    const includeCron = opts?.includeCron ?? true;
    // 1. 读取主会话消息
    const mainMessages = readSessionHistory(sessionKey, opts);
    if (!includeCron)
        return mainMessages;
    // 2. 从主会话 JSONL 中提取关联的 cron job IDs
    //    这是关键——通过扫描主会话中 cron 工具调用的返回结果，
    //    获取用户在这个会话中创建的所有 cron job 的 ID
    const cronJobIds = opts?.cronJobIds ?? extractCronJobIdsFromTranscript(sessionKey, opts?.agentId);
    if (cronJobIds.length === 0)
        return mainMessages;
    // 3. 用 cron job IDs 精确查找关联的 cron run sessions
    //    不再遍历所有 cron sessions，只查找与主会话显式关联的
    const cronSessions = findCronSessionsByJobIds(cronJobIds, opts?.agentId);
    if (cronSessions.length === 0)
        return mainMessages;
    // 4. 确定时间窗口——只取主会话时间范围内的 cron 消息
    const mainTimestamps = mainMessages
        .map((m) => m.timestamp)
        .filter((t) => t !== undefined);
    const timeWindowStart = mainTimestamps.length > 0
        ? Math.min(...mainTimestamps) - 60_000 // 往前延1分钟
        : 0;
    // 5. 读取 cron 消息（按时间窗口过滤）
    const cronMessages = [];
    const relevantSessions = cronSessions.filter((cs) => !cs.updatedAt || cs.updatedAt >= timeWindowStart);
    for (const cs of relevantSessions) {
        const msgs = readSessionHistory(cs.sessionKey, {
            ...opts,
            chatOnly: true,
            limit: 50, // 每个 cron run 最多取 50 条
        });
        for (const msg of msgs) {
            // 时间窗口过滤
            if (msg.timestamp && msg.timestamp < timeWindowStart)
                continue;
            // cron run 的 user 消息是系统自动生成的 prompt 模板，不是用户真实输入，跳过
            if (msg.role === "user")
                continue;
            msg.cronInfo = {
                jobId: cs.cronJobId,
                name: cs.cronName,
                runSessionId: cs.sessionId,
            };
            cronMessages.push(msg);
        }
    }
    if (cronMessages.length === 0)
        return mainMessages;
    // 6. 按时间合并
    const merged = [...mainMessages, ...cronMessages]
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    return merged.length > limit ? merged.slice(-limit) : merged;
}
// ============================================================
// Session 列表
// ============================================================
/**
 * 列出所有已知的 session（从 sessions.json 索引读取）
 *
 * 增强：每个条目标识会话类型（direct / cron-base / cron-run）
 */
export function listSessions(agentId) {
    const store = loadSessionStore(agentId);
    return Object.entries(store)
        .filter(([, entry]) => entry && entry.sessionId)
        .map(([key, entry]) => ({
        sessionKey: key,
        sessionId: entry.sessionId,
        updatedAt: entry.updatedAt,
        label: entry.label,
        displayName: entry.displayName,
        channel: entry.channel,
        sessionType: classifySessionKey(key),
        cronJobId: extractCronJobId(key) ?? undefined,
    }))
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
// ============================================================
// 内部工具函数
// ============================================================
/**
 * 解析完整 transcript 文件内容
 */
function parseTranscriptLines(raw, opts) {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    return parseLines(lines, opts);
}
/**
 * 解析 JSONL 行数组为 HistoryMessage[]
 */
function parseLines(lines, opts) {
    const { limit, chatOnly } = opts;
    const messages = [];
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            const lineType = parsed?.type;
            // 非消息行：显式跳过已知的元数据行类型
            if (lineType === "session" || lineType === "model_change"
                || lineType === "thinking_level_change" || lineType === "custom") {
                continue;
            }
            // compaction 标记
            if (lineType === "compaction") {
                if (!chatOnly) {
                    const ts = typeof parsed.timestamp === "string" ? Date.parse(parsed.timestamp) : undefined;
                    messages.push({
                        role: "system",
                        content: "── Context compacted ──",
                        timestamp: ts && Number.isFinite(ts) ? ts : Date.now(),
                        isCompaction: true,
                    });
                }
                continue;
            }
            // 标准消息行
            const msg = parsed?.message;
            if (!msg || typeof msg !== "object")
                continue;
            // 过滤传输层伪装为 user 的系统注入消息
            if (isSystemInjectedUserMessage(msg))
                continue;
            const normalized = normalizeMessage(msg);
            if (!normalized)
                continue;
            if (chatOnly && normalized.role !== "user" && normalized.role !== "assistant")
                continue;
            messages.push(normalized);
        }
        catch {
            // 跳过格式错误的行
        }
    }
    // 只返回最后 limit 条
    return messages.length > limit ? messages.slice(-limit) : messages;
}
//# sourceMappingURL=session-reader.js.map