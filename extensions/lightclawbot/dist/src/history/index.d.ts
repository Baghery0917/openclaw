/**
 * LightClaw — History Module
 *
 * 统一导出历史消息处理的全部公开 API。
 *
 * 模块结构：
 *   types.ts           — 类型定义
 *   session-store.ts    — session 索引加载 & 路径解析
 *   text-processing.ts  — 传输元数据剥离 & 文件附件提取
 *   message-parser.ts   — JSONL 消息行解析 & 标准化
 *   cron-utils.ts       — cron session key 解析 & cron 消息清理
 *   session-reader.ts   — 核心读取 API（含混合读取）
 */
export type { FileAttachmentInfo, CronInfo, HistoryMessage, SessionStoreEntry, SessionType, CronSessionInfo, SessionListEntry, ReadHistoryOptions, ReadHistoryWithCronOptions, ReadHistoryTailOptions, ContentEntry, } from "./types.js";
export { resolveOpenClawHome, resolveSessionsDir, loadSessionStore, resolveTranscriptPath, getStoreDir, } from "./session-store.js";
export { stripTransportMetadata, stripResidualMetadata, extractFileAttachments, deduplicateFiles, } from "./text-processing.js";
export { isSystemInjectedUserMessage, extractText, extractRawText, extractThinking, extractToolCalls, extractContentFiles, normalizeMessage, } from "./message-parser.js";
export { isCronSessionKey, isCronRunKey, isCronBaseKey, extractCronJobId, extractCronRunId, classifySessionKey, listCronSessions, groupCronSessionsByJob, extractCronInfoFromText, cleanCronUserMessage, extractCronJobIdsFromTranscript, findCronSessionsByJobIds, } from "./cron-utils.js";
export { readSessionHistory, readSessionHistoryTail, readCronHistory, readSessionHistoryWithCron, listSessions, } from "./session-reader.js";
//# sourceMappingURL=index.d.ts.map