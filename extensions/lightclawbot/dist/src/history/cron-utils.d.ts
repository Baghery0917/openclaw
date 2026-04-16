/**
 * LightClaw — Cron Utilities
 *
 * 封装 OpenClaw cron（定时任务）相关的工具函数：
 *   - Session Key 解析与判断
 *   - Cron session 列表查询
 *   - 从主会话 JSONL 中提取关联的 cron job ID
 *   - Cron 消息内容清理（提取有效 payload）
 */
import type { CronSessionInfo, SessionType } from "./types.js";
/** 判断 session key 是否为 cron 相关 */
export declare function isCronSessionKey(key: string): boolean;
/** 判断 session key 是否为 cron run（单次运行） */
export declare function isCronRunKey(key: string): boolean;
/** 判断 session key 是否为 cron base（cron 任务定义） */
export declare function isCronBaseKey(key: string): boolean;
/** 从 cron session key 中提取 job ID */
export declare function extractCronJobId(key: string): string | null;
/** 从 cron run key 中提取 run ID */
export declare function extractCronRunId(key: string): string | null;
/**
 * 判断 session key 的会话类型
 */
export declare function classifySessionKey(key: string): SessionType;
/**
 * 从 sessions.json 中列出所有 cron run session
 *
 * @param agentId - Agent ID，默认 "main"
 * @returns 按更新时间降序排列的 cron session 列表
 */
export declare function listCronSessions(agentId?: string): CronSessionInfo[];
/**
 * 按 cron job ID 分组获取 cron sessions
 *
 * @returns Map<cronJobId, CronSessionInfo[]>，每组按时间正序
 */
export declare function groupCronSessionsByJob(agentId?: string): Map<string, CronSessionInfo[]>;
export declare function extractCronInfoFromText(text: string): {
    jobId: string;
    name: string;
} | null;
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
export declare function cleanCronUserMessage(text: string): string;
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
export declare function extractCronJobIdsFromTranscript(sessionKey: string, agentId?: string): string[];
/**
 * 根据 cron job ID 列表，从 sessions.json 中找到所有关联的 cron run sessions
 *
 * 这是新的关联机制的核心——不再遍历所有 cron sessions，
 * 而是只查找与主会话**显式关联**的 cron job 的运行记录。
 */
export declare function findCronSessionsByJobIds(cronJobIds: string[], agentId?: string): CronSessionInfo[];
//# sourceMappingURL=cron-utils.d.ts.map