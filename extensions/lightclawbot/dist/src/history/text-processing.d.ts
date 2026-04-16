/**
 * LightClaw — Text Processing
 *
 * 封装传输层元数据剥离和文件附件信息提取逻辑。
 * 用于将 OpenClaw 注入的传输层前缀/后缀从用户消息中清除，
 * 以及从原始消息文本中提取文件附件信息。
 */
import type { FileAttachmentInfo } from "./types.js";
/**
 * 剥离 OpenClaw 传输层注入到用户消息中的元数据前缀，提取用户真正的输入。
 *
 * 采用 **双层策略** 以通用应对不断变化的注入格式：
 *
 * **第一层 — 锚点截断（优先）：**
 *   OpenClaw 注入的元数据遵循固定尾部结构：最后一个 `Xxx (untrusted metadata):` 块
 *   之后即为用户真正输入。找到该锚点并截断，天然兼容前方任意 operator 前缀。
 *
 * **第二层 — 逐条正则剥离（后备）：**
 *   当消息中不含 `(untrusted metadata)` 锚点时（如纯系统消息），回退到模式匹配。
 */
export declare function stripTransportMetadata(text: string): string;
/**
 * 剥离残留的传输层元数据片段。
 *
 * 用于：
 *   1. 锚点截断后的残余清理
 *   2. 不含 untrusted metadata 的消息的后备剥离
 */
export declare function stripResidualMetadata(text: string): string;
/**
 * 从用户消息文本中提取文件附件信息。
 *
 * 匹配 "用户发送了文件: xxx.png (3.0KB)" 格式。
 * 以及 [media attached: .../name---uuid.ext (mime/type) | file://...] 格式。
 */
export declare function extractFileAttachments(text: string): FileAttachmentInfo[];
/**
 * 文件去重（按文件名）
 */
export declare function deduplicateFiles(files: FileAttachmentInfo[]): FileAttachmentInfo[];
//# sourceMappingURL=text-processing.d.ts.map