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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// 获取当前文件的目录
// const currentDir = path.dirname(import.meta.url);
// ============================================================
// 路径解析
// ============================================================
/** 获取 OpenClaw 数据目录 */
export function resolveOpenClawHome() {
    return process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
}
/**
 * 解析 agentId 对应的 sessions 目录
 * 默认 agentId 为 "main"（与 OpenClaw DEFAULT_AGENT_ID 一致）
 */
export function resolveSessionsDir(agentId) {
    const home = resolveOpenClawHome();
    const id = agentId?.trim() || "main";
    return path.join(home, "agents", id, "sessions");
}
// ============================================================
// Session Store 加载
// ============================================================
/**
 * sessions.json 的实际磁盘路径（加载成功后缓存）
 *
 * 用于第3层回退：当标准目录下找不到 .jsonl 文件时，
 * 尝试在 sessions.json 所在目录查找（离线 / 下载到本地场景）。
 */
let _lastStoreFilePath = null;
/**
 * 加载 sessions.json 索引，获取 sessionKey → sessionEntry 映射
 */
export function loadSessionStore(agentId) {
    const storePath = path.join(resolveSessionsDir(agentId), "sessions.json");
    //   const storePath = path.join(currentDir, "../../sessions/sessions.json").replace("file:", "");
    const loaded = _tryLoadStore(storePath);
    if (loaded)
        return loaded;
    // 标准路径失败 → 尝试从 OPENCLAW_HOME 根下直接查找 sessions.json
    // （兼容平铺结构）
    const home = resolveOpenClawHome();
    const rootStorePath = path.join(home, "sessions", "sessions.json");
    if (rootStorePath !== storePath) {
        const rootLoaded = _tryLoadStore(rootStorePath);
        if (rootLoaded)
            return rootLoaded;
    }
    return {};
}
function _tryLoadStore(storePath) {
    try {
        const raw = fs.readFileSync(storePath, "utf-8");
        if (!raw.trim())
            return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            _lastStoreFilePath = storePath;
            return parsed;
        }
    }
    catch {
        // 文件不存在或解析失败
    }
    return null;
}
/**
 * 获取 sessions.json 所在目录（用于第3层路径回退）
 */
export function getStoreDir() {
    return _lastStoreFilePath ? path.dirname(_lastStoreFilePath) : null;
}
// ============================================================
// Transcript 文件路径解析
// ============================================================
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
export function resolveTranscriptPath(sessionKey, agentId) {
    const store = loadSessionStore(agentId);
    const normalizedKey = sessionKey.trim().toLowerCase();
    // 尝试精确匹配和 case-insensitive 匹配
    const entry = store[sessionKey]
        ?? store[normalizedKey]
        ?? Object.entries(store).find(([k]) => k.toLowerCase() === normalizedKey)?.[1];
    if (!entry?.sessionId)
        return null;
    const sessionsDir = resolveSessionsDir(agentId);
    const jsonlFileName = `${entry.sessionId}.jsonl`;
    // 第1层：使用 entry.sessionFile（精确路径）
    if (entry.sessionFile) {
        const sessionFilePath = path.isAbsolute(entry.sessionFile)
            ? entry.sessionFile
            : path.join(sessionsDir, entry.sessionFile);
        if (fs.existsSync(sessionFilePath))
            return sessionFilePath;
        // sessionFile 是远程服务器的绝对路径，在本地不存在 → 继续回退
    }
    // 第2层：标准目录 <sessionsDir>/<sessionId>.jsonl
    const defaultPath = path.join(sessionsDir, jsonlFileName);
    if (fs.existsSync(defaultPath))
        return defaultPath;
    // 第3层：sessions.json 同级目录下查找
    // 适用场景：用户将远程 session 文件下载到本地平铺目录
    const storeDir = getStoreDir();
    if (storeDir && storeDir !== sessionsDir) {
        const siblingPath = path.join(storeDir, jsonlFileName);
        if (fs.existsSync(siblingPath))
            return siblingPath;
    }
    // 第4层：查找被 Cron Session Reaper 归档的文件
    // 格式：<sessionId>.jsonl.deleted.<timestamp> 或 <sessionId>.jsonl.reset.<timestamp>
    // 在标准目录和 storeDir 中都尝试查找
    const archivedPath = _findArchivedTranscript(sessionsDir, jsonlFileName);
    if (archivedPath)
        return archivedPath;
    if (storeDir && storeDir !== sessionsDir) {
        const archivedInStore = _findArchivedTranscript(storeDir, jsonlFileName);
        if (archivedInStore)
            return archivedInStore;
    }
    return null;
}
/**
 * 在指定目录中查找归档的 transcript 文件
 *
 * 归档文件命名规则：<sessionId>.jsonl.<reason>.<ISO-timestamp>
 * 例如：bac16e65-xxx.jsonl.deleted.2026-03-14T02-18-02.812Z
 *
 * 如果存在多个归档文件（理论上不会），返回最新的那个。
 */
function _findArchivedTranscript(dir, jsonlFileName) {
    try {
        const files = fs.readdirSync(dir);
        // 匹配 <sessionId>.jsonl.deleted.* 或 <sessionId>.jsonl.reset.* 等归档后缀
        const prefix = jsonlFileName + ".";
        const archived = files
            .filter((f) => f.startsWith(prefix) && /\.(deleted|reset)\.\d{4}-/.test(f))
            .sort() // 按字母排序，时间戳越新越靠后
            .pop(); // 取最新的
        if (archived) {
            return path.join(dir, archived);
        }
    }
    catch {
        // 目录不存在或无权读取
    }
    return null;
}
//# sourceMappingURL=session-store.js.map