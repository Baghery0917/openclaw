/**
 * LightClaw — Cron Utilities
 *
 * 封装 OpenClaw cron（定时任务）相关的工具函数：
 *   - Session Key 解析与判断
 *   - Cron session 列表查询
 *   - 从主会话 JSONL 中提取关联的 cron job ID
 *   - Cron 消息内容清理（提取有效 payload）
 */
import fs from "node:fs";
import { loadSessionStore, resolveTranscriptPath } from "./session-store.js";
import { stripResidualMetadata } from "./text-processing.js";
// ============================================================
// Session Key 正则
// ============================================================
/** Cron 基础 key: agent:<agentId>:cron:<cronJobId> */
const CRON_BASE_KEY_RE = /^agent:[^:]+:cron:([0-9a-f-]+)$/;
/** Cron 运行 key: agent:<agentId>:cron:<cronJobId>:run:<runId> */
const CRON_RUN_KEY_RE = /^agent:[^:]+:cron:([0-9a-f-]+):run:([0-9a-f-]+)$/;
// ============================================================
// Session Key 解析
// ============================================================
/** 判断 session key 是否为 cron 相关 */
export function isCronSessionKey(key) {
    return CRON_BASE_KEY_RE.test(key) || CRON_RUN_KEY_RE.test(key);
}
/** 判断 session key 是否为 cron run（单次运行） */
export function isCronRunKey(key) {
    return CRON_RUN_KEY_RE.test(key);
}
/** 判断 session key 是否为 cron base（cron 任务定义） */
export function isCronBaseKey(key) {
    return CRON_BASE_KEY_RE.test(key);
}
/** 从 cron session key 中提取 job ID */
export function extractCronJobId(key) {
    return key.match(CRON_BASE_KEY_RE)?.[1]
        ?? key.match(CRON_RUN_KEY_RE)?.[1]
        ?? null;
}
/** 从 cron run key 中提取 run ID */
export function extractCronRunId(key) {
    return key.match(CRON_RUN_KEY_RE)?.[2] ?? null;
}
/**
 * 判断 session key 的会话类型
 */
export function classifySessionKey(key) {
    if (CRON_RUN_KEY_RE.test(key))
        return "cron-run";
    if (CRON_BASE_KEY_RE.test(key))
        return "cron-base";
    return "direct";
}
// ============================================================
// Cron Session 列表
// ============================================================
/**
 * 从 sessions.json 中列出所有 cron run session
 *
 * @param agentId - Agent ID，默认 "main"
 * @returns 按更新时间降序排列的 cron session 列表
 */
export function listCronSessions(agentId) {
    const store = loadSessionStore(agentId);
    return Object.entries(store)
        .filter(([key]) => CRON_RUN_KEY_RE.test(key))
        .map(([key, entry]) => {
        const cronJobId = extractCronJobId(key) ?? "";
        const cronName = entry.label?.replace(/^Cron:\s*/, "");
        return {
            sessionKey: key,
            sessionId: entry.sessionId,
            cronJobId,
            cronName,
            updatedAt: entry.updatedAt,
        };
    })
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
/**
 * 按 cron job ID 分组获取 cron sessions
 *
 * @returns Map<cronJobId, CronSessionInfo[]>，每组按时间正序
 */
export function groupCronSessionsByJob(agentId) {
    const sessions = listCronSessions(agentId);
    const groups = new Map();
    for (const session of sessions) {
        const list = groups.get(session.cronJobId) ?? [];
        list.push(session);
        groups.set(session.cronJobId, list);
    }
    // 每组内按时间正序
    for (const [, list] of groups) {
        list.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
    }
    return groups;
}
// ============================================================
// Cron 消息内容清理
// ============================================================
/**
 * 从 cron 消息文本中提取 cron 标识信息
 *
 * 匹配格式：[cron:<jobId> <name>] ...
 */
const CRON_MSG_PREFIX_RE = /\[cron:([0-9a-f-]+)\s+([^\]]+)\]/;
export function extractCronInfoFromText(text) {
    const m = text.match(CRON_MSG_PREFIX_RE);
    return m ? { jobId: m[1], name: m[2] } : null;
}
/**
 * 清理 cron run 的 user 消息，提取 cron 任务的实际 payload。
 *
 * 原始格式：
 *   Skills store policy (operator configured):
 *   ...
 *   [cron:jobId 任务名] <actual payload>
 *   Current time: ...
 *   Return your summary as plain text; ...
 *
 * 提取为：
 *   [每2分钟喝水提醒] <actual payload>
 */
export function cleanCronUserMessage(text) {
    if (!text)
        return text;
    // 提取 [cron:xxx name] 后面的内容
    const cronPrefixMatch = text.match(/\[cron:[0-9a-f-]+\s+([^\]]+)\]\s*([\s\S]*)/);
    if (!cronPrefixMatch)
        return stripResidualMetadata(text);
    const cronName = cronPrefixMatch[1];
    let payload = cronPrefixMatch[2];
    // 移除尾部的系统指令
    payload = payload
        .replace(/Current time:.*$/m, "")
        .replace(/Return your summary as plain text[\s\S]*/m, "")
        .trim();
    return `[${cronName}] ${payload}`;
}
// ============================================================
// 从主会话 JSONL 中提取关联的 Cron Job IDs
// ============================================================
/**
 * 从 toolResult 的 content 文本中提取 cron job id
 *
 * cron 工具返回的结果格式如：
 *   { "id": "3d16ddcb-...", "name": "喝水提醒", ... }
 *
 * 需要匹配 toolName 为 "cron" 的 toolResult，并从 content 中解析 JSON 提取 id。
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/**
 * 扫描主会话的 JSONL transcript 文件，提取所有通过 cron 工具创建的 job ID。
 *
 * 关联逻辑：
 *   1. 读取主会话的 .jsonl 文件
 *   2. 找到 type=message、role=toolResult、toolName=cron 的行
 *   3. 从 toolResult 的 content 中解析出 cron job 的 id 字段
 *   4. 返回去重后的 cron job ID 列表
 *
 * 这建立了主会话和 cron sessions 之间的**显式关联关系**：
 *   主会话 JSONL → cron tool results → cron job IDs → sessions.json 中的 cron run keys
 */
export function extractCronJobIdsFromTranscript(sessionKey, agentId) {
    const filePath = resolveTranscriptPath(sessionKey, agentId);
    if (!filePath)
        return [];
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf-8");
    }
    catch {
        return [];
    }
    const jobIds = new Set();
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (parsed?.type !== "message")
                continue;
            const msg = parsed?.message;
            if (!msg)
                continue;
            // 方式1：从 toolResult (role=toolResult, toolName=cron) 中提取
            const role = msg.role?.toLowerCase();
            if (role === "toolresult" || role === "tool_result" || role === "tool") {
                const toolName = msg.toolName ?? msg.tool_name ?? msg.name ?? "";
                if (toolName === "cron") {
                    const id = _extractCronIdFromToolResult(msg.content);
                    if (id)
                        jobIds.add(id);
                }
            }
            // 方式2：从 assistant 消息的 toolCall 返回中提取
            // （有些 JSONL 格式会将 toolResult 内联在 assistant content 中）
            if (role === "assistant" && Array.isArray(msg.content)) {
                for (const entry of msg.content) {
                    if (entry?.type === "toolCall" && entry.name === "cron") {
                        // toolCall 本身不含结果，结果在后续的 toolResult 行中
                        continue;
                    }
                }
            }
        }
        catch {
            // 跳过格式错误的行
        }
    }
    return [...jobIds];
}
/**
 * 从 cron toolResult 的 content 中解析出 job id
 */
function _extractCronIdFromToolResult(content) {
    // content 可能是 string 或 array
    const text = _extractToolResultText(content);
    if (!text)
        return null;
    try {
        // 尝试直接 JSON.parse 整个文本
        const obj = JSON.parse(text);
        // cron add 返回有 id 字段
        if (obj?.id && UUID_RE.test(obj.id))
            return obj.id;
        // cron list 返回的 jobs 数组中也有 id
        if (Array.isArray(obj?.jobs)) {
            for (const job of obj.jobs) {
                if (job?.id && UUID_RE.test(job.id))
                    return job.id;
            }
        }
    }
    catch {
        // JSON 解析失败，尝试正则提取 "id": "uuid" 模式
        const idMatch = text.match(/"id"\s*:\s*"([0-9a-f-]{36})"/i);
        if (idMatch)
            return idMatch[1];
    }
    return null;
}
/**
 * 从 toolResult content 字段提取纯文本
 */
function _extractToolResultText(content) {
    if (typeof content === "string")
        return content;
    if (!Array.isArray(content))
        return null;
    for (const entry of content) {
        if (entry && typeof entry === "object" && typeof entry.text === "string") {
            return entry.text;
        }
    }
    return null;
}
// ============================================================
// 基于 Job IDs 查找 Cron Sessions
// ============================================================
/**
 * 根据 cron job ID 列表，从 sessions.json 中找到所有关联的 cron run sessions
 *
 * 这是新的关联机制的核心——不再遍历所有 cron sessions，
 * 而是只查找与主会话**显式关联**的 cron job 的运行记录。
 */
export function findCronSessionsByJobIds(cronJobIds, agentId) {
    if (cronJobIds.length === 0)
        return [];
    const jobIdSet = new Set(cronJobIds);
    const store = loadSessionStore(agentId);
    return Object.entries(store)
        .filter(([key]) => {
        const jobId = extractCronJobId(key);
        return jobId !== null && jobIdSet.has(jobId) && CRON_RUN_KEY_RE.test(key);
    })
        .map(([key, entry]) => {
        const cronJobId = extractCronJobId(key) ?? "";
        const cronName = entry.label?.replace(/^Cron:\s*/, "");
        return {
            sessionKey: key,
            sessionId: entry.sessionId,
            cronJobId,
            cronName,
            updatedAt: entry.updatedAt,
        };
    })
        .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0)); // 时间正序
}
//# sourceMappingURL=cron-utils.js.map