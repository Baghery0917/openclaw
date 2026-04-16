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
import type { FileAttachmentInfo, HistoryMessage } from "./types.js";
/**
 * 检测 role=user 的消息是否实际上是传输层/系统注入的消息，而非用户真实输入。
 *
 * 匹配 "System: [timestamp]" 格式的消息（包括 cron 定时提醒触发的注入消息）。
 * 这些消息本质上都是系统自动生成的指令文本，不是用户手动输入，
 * 用户只需看到 assistant 的回复即可。
 */
export declare function isSystemInjectedUserMessage(msg: Record<string, unknown>): boolean;
/**
 * 从 content 字段提取纯文本（用户消息会剥离传输元数据）
 */
export declare function extractText(content: unknown, role?: string): string;
/**
 * 从 content 字段提取原始文本（不做剥离，用于文件信息提取）
 */
export declare function extractRawText(content: unknown): string;
/**
 * 从 content 字段提取 thinking 内容
 */
export declare function extractThinking(content: unknown): string | undefined;
/**
 * 从 content 字段提取工具调用信息
 *
 * 兼容 type: "tool_use" / "tool_call" / "toolCall"
 * 兼容参数字段: input / arguments / args
 */
export declare function extractToolCalls(content: unknown): Array<{
    name: string;
    args?: string;
}> | undefined;
/**
 * 从 content 字段提取文件/图片信息
 */
export declare function extractContentFiles(content: unknown): FileAttachmentInfo[] | undefined;
/**
 * 将原始 JSONL message 对象标准化为 HistoryMessage
 */
export declare function normalizeMessage(msg: Record<string, unknown>): HistoryMessage | null;
//# sourceMappingURL=message-parser.d.ts.map