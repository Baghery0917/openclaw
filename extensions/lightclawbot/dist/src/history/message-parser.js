/**
 * LightClaw — Message Parser
 *
 * 封装 JSONL session transcript 中消息行的解析和标准化逻辑。
 * 包含：
 *   - 文本提取（含传输层元数据剥离）
 *   - thinking 内容提取
 *   - 工具调用/结果提取
 *   - 文件附件提取
 *   - 系统注入消息检测
 *   - 消息标准化
 */
import { stripTransportMetadata, extractFileAttachments, deduplicateFiles, } from "./text-processing.js";
// ============================================================
// 系统注入消息检测
// ============================================================
/**
 * 匹配 "System: [<timestamp>]" 格式的消息前缀。
 * 如定时提醒回调：System: [2026-03-05 16:23:00 GMT+8] ⏰ 提醒：该看日志啦！
 */
const SYSTEM_INJECTED_RE = /^System:\s*\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/;
/**
 * 检测 role=user 的消息是否实际上是传输层/系统注入的消息，而非用户真实输入。
 *
 * 匹配 "System: [timestamp]" 格式的消息（包括 cron 定时提醒触发的注入消息）。
 * 这些消息本质上都是系统自动生成的指令文本，不是用户手动输入，
 * 用户只需看到 assistant 的回复即可。
 */
export function isSystemInjectedUserMessage(msg) {
    if (msg.role?.toLowerCase() !== "user")
        return false;
    const text = extractFirstText(msg.content);
    if (!text)
        return false;
    const trimmed = text.trim();
    // 所有 "System: [timestamp]" 格式的消息都是系统注入的，包括定时提醒触发消息
    return SYSTEM_INJECTED_RE.test(trimmed);
}
/**
 * 提取消息内容中的第一个文本片段（用于系统注入检测）
 */
function extractFirstText(content) {
    if (typeof content === "string")
        return content;
    if (!Array.isArray(content))
        return undefined;
    for (const entry of content) {
        if (!entry || typeof entry !== "object")
            continue;
        if ((entry.type === "text" || entry.type === "input_text")
            && typeof entry.text === "string") {
            return entry.text;
        }
    }
    return undefined;
}
// ============================================================
// 内容提取
// ============================================================
/**
 * 从 content 字段提取纯文本（用户消息会剥离传输元数据）
 */
export function extractText(content, role) {
    if (typeof content === "string") {
        return role === "user" ? stripTransportMetadata(content) : content;
    }
    if (!Array.isArray(content))
        return "";
    const parts = [];
    for (const entry of content) {
        if (!entry || typeof entry !== "object")
            continue;
        if ((entry.type === "text" || entry.type === "output_text" || entry.type === "input_text")
            && typeof entry.text === "string") {
            parts.push(entry.text);
        }
    }
    const joined = parts.join("\n");
    return role === "user" ? stripTransportMetadata(joined) : joined;
}
/**
 * 从 content 字段提取原始文本（不做剥离，用于文件信息提取）
 */
export function extractRawText(content) {
    if (typeof content === "string")
        return content;
    if (!Array.isArray(content))
        return "";
    const parts = [];
    for (const entry of content) {
        if (!entry || typeof entry !== "object")
            continue;
        if ((entry.type === "text" || entry.type === "output_text" || entry.type === "input_text")
            && typeof entry.text === "string") {
            parts.push(entry.text);
        }
    }
    return parts.join("\n");
}
/**
 * 从 content 字段提取 thinking 内容
 */
export function extractThinking(content) {
    if (!Array.isArray(content))
        return undefined;
    const parts = [];
    for (const entry of content) {
        if (!entry || typeof entry !== "object")
            continue;
        if (entry.type === "thinking") {
            const text = typeof entry.thinking === "string"
                ? entry.thinking
                : typeof entry.text === "string" ? entry.text : undefined;
            if (text)
                parts.push(text);
        }
    }
    return parts.length > 0 ? parts.join("\n") : undefined;
}
/**
 * 从 content 字段提取工具调用信息
 *
 * 兼容 type: "tool_use" / "tool_call" / "toolCall"
 * 兼容参数字段: input / arguments / args
 */
export function extractToolCalls(content) {
    if (!Array.isArray(content))
        return undefined;
    const calls = [];
    for (const entry of content) {
        if (!entry || typeof entry !== "object")
            continue;
        if (entry.type === "tool_use" || entry.type === "tool_call" || entry.type === "toolCall") {
            const name = typeof entry.name === "string"
                ? entry.name
                : typeof entry.toolName === "string"
                    ? entry.toolName
                    : typeof entry.tool_name === "string"
                        ? entry.tool_name
                        : "unknown";
            const rawArgs = entry.input ?? entry.arguments ?? entry.args;
            const args = rawArgs
                ? (typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs))
                : undefined;
            calls.push({ name, args });
        }
    }
    return calls.length > 0 ? calls : undefined;
}
/**
 * 从 content 字段提取文件/图片信息
 */
export function extractContentFiles(content) {
    if (!Array.isArray(content))
        return undefined;
    const files = [];
    for (const entry of content) {
        if (!entry || typeof entry !== "object")
            continue;
        if (entry.type === "image" || entry.type === "file") {
            // 跳过只有 data 字段的内嵌 base64 图片
            if (entry.type === "image" && entry.data && !entry.uri && !entry.fileName && !entry.file_name && !entry.filename) {
                continue;
            }
            const name = asString(entry.fileName) ?? asString(entry.file_name) ?? asString(entry.filename) ?? asString(entry.name) ?? (entry.type === "image" ? "image" : "file");
            const mimeType = asString(entry.mimeType) ?? asString(entry.mime_type);
            const uri = asString(entry.uri);
            files.push({ name, mimeType, uri });
        }
    }
    return files.length > 0 ? files : undefined;
}
/** 安全提取非空字符串 */
function asString(v) {
    return typeof v === "string" && v.trim() ? v : undefined;
}
// ============================================================
// 消息标准化
// ============================================================
/**
 * 将原始 JSONL message 对象标准化为 HistoryMessage
 */
export function normalizeMessage(msg) {
    const role = msg.role;
    if (!role)
        return null;
    const normalizedRole = (() => {
        switch (role.toLowerCase()) {
            case "user": return "user";
            case "assistant": return "assistant";
            case "system": return "system";
            case "tool":
            case "toolresult":
            case "tool_result":
                return "tool";
            default: return "assistant";
        }
    })();
    const text = extractText(msg.content, normalizedRole);
    const toolCalls = normalizedRole === "assistant" ? extractToolCalls(msg.content) : undefined;
    const thinking = normalizedRole === "assistant" ? extractThinking(msg.content) : undefined;
    const timestamp = typeof msg.timestamp === "number" ? msg.timestamp : undefined;
    // 从用户消息文本中提取文件附件
    let files;
    if (normalizedRole === "user") {
        const rawText = extractRawText(msg.content);
        const textFiles = extractFileAttachments(rawText);
        const contentFiles = extractContentFiles(msg.content);
        const allFiles = [...(textFiles.length > 0 ? textFiles : []), ...(contentFiles ?? [])];
        if (allFiles.length > 0)
            files = deduplicateFiles(allFiles);
    }
    else {
        files = extractContentFiles(msg.content) || undefined;
    }
    // tool / toolResult 角色的处理
    let toolResult;
    if (normalizedRole === "tool") {
        const toolCallId = asString(msg.toolCallId)
            ?? asString(msg.tool_call_id)
            ?? asString(msg.callId);
        const name = asString(msg.name)
            ?? asString(msg.toolName)
            ?? asString(msg.tool_name);
        const output = text
            || (msg.result ? (typeof msg.result === "string" ? msg.result : JSON.stringify(msg.result)) : undefined)
            || undefined;
        toolResult = { toolCallId, name, output };
    }
    // 跳过完全空的消息
    if (!text && !toolCalls && !toolResult && !thinking && !files?.length)
        return null;
    return {
        role: normalizedRole,
        content: text,
        timestamp,
        ...(toolCalls && { toolCalls }),
        ...(toolResult && { toolResult }),
        ...(thinking && { thinking }),
        ...(files && files.length > 0 && { files }),
    };
}
//# sourceMappingURL=message-parser.js.map