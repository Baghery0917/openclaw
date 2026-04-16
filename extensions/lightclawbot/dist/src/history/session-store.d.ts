/**
 * LightClaw — Session Store
 *
 * 封装 OpenClaw sessions.json 索引的读取和路径解析逻辑。
 * 所有 session 文件的定位都通过此模块完成。
 *
 * 路径解析策略（多层回退）：
 *   1. entry.sessionFile（精确路径 / 相对路径）
 *   2. OPENCLAW_HOME/agents/<agentId>/sessions/<sessionId>.jsonl（标准目录）
 *   3. sessions.json 同级目录下的 <sessionId>.jsonl（离线分析场景，
 *      如把远程服务器的 session 文件下载到本地）
 */
import type { SessionStoreEntry } from "./types.js";
/** 获取 OpenClaw 数据目录 */
export declare function resolveOpenClawHome(): string;
/**
 * 解析 agentId 对应的 sessions 目录
 * 默认 agentId 为 "main"（与 OpenClaw DEFAULT_AGENT_ID 一致）
 */
export declare function resolveSessionsDir(agentId?: string): string;
/**
 * 加载 sessions.json 索引，获取 sessionKey → sessionEntry 映射
 */
export declare function loadSessionStore(agentId?: string): Record<string, SessionStoreEntry>;
/**
 * 获取 sessions.json 所在目录（用于第3层路径回退）
 */
export declare function getStoreDir(): string | null;
/**
 * 根据 sessionKey 找到对应的 .jsonl transcript 文件路径
 *
 * 路径解析优先级：
 *   1. entry.sessionFile — 绝对路径 / 相对于 sessionsDir 的路径
 *   2. sessionsDir/<sessionId>.jsonl — 标准 OPENCLAW_HOME 目录
 *   3. storeDir/<sessionId>.jsonl — sessions.json 同级目录（离线分析场景）
 *   4. 归档文件回退 — 查找 <sessionId>.jsonl.deleted.* / .reset.*
 *      （Cron Session Reaper 会将已完成的 cron run session 文件重命名为
 *       <sessionId>.jsonl.deleted.<timestamp>，导致标准路径找不到。
 *       尤其是 deleteAfterRun=true 的一次性 cron 任务，执行后几乎立即被归档。）
 */
export declare function resolveTranscriptPath(sessionKey: string, agentId?: string): string | null;
//# sourceMappingURL=session-store.d.ts.map