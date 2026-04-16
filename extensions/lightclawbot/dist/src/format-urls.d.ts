/**
 * LightClaw — 文件 URL 格式化
 *
 * 将消息文本中的裸文件下载链接自动转换为 Markdown 链接格式：
 *   裸链接:     https://lightai.cloud.tencent.com/drive/preview?filePath=2026-03-15/report.pdf
 *   Markdown:   [report.pdf](https://lightai.cloud.tencent.com/drive/preview?filePath=2026-03-15/report.pdf)
 *
 * 使用场景：
 *   1. gateway.ts  sendReply / sendFiles — 兜底确保最终发出去的消息格式正确
 *   2. outbound.ts sendViaSocket         — 出站消息同理
 *
 * 设计要点：
 *   - 负向后瞻 (?<!\]\() 避免对已有 Markdown 链接二次包装
 *   - 负向后瞻 (?<!\() 避免对 (URL) 形式的括号内链接重复处理
 *   - 从 filePath 参数提取文件名作为链接文本
 */
/**
 * 将文本中的裸文件下载链接转换为 Markdown 链接。
 *
 * 已是 `[xxx](url)` 格式的不会被重复处理。
 *
 * @param text - 原始消息文本
 * @returns 转换后的文本
 */
export declare function formatCosUrls(text: string): string;
//# sourceMappingURL=format-urls.d.ts.map