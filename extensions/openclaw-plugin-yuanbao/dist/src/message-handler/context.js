export const YUANBAO_FINAL_TEXT_CHUNK_LIMIT = 3000;
export const YUANBAO_OVERFLOW_NOTICE_TEXT = '内容较长，已停止发送剩余内容。';
export const YUANBAO_MARKDOWN_HINT = '⚠️ 格式规范（强制）：当回复内容包含 Markdown 表格时，禁止用 ```markdown 代码块包裹，直接输出表格内容即可，不需要外层 fence。';
export function stripOuterMarkdownFence(text) {
    const HAS_TABLE = /^\s*\|[-:| ]+\|/m;
    return text.replace(/```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/gm, (fullMatch, inner) => (HAS_TABLE.test(inner) ? inner : fullMatch));
}
export const REPLY_TIMEOUT_MS = 5 * 60 * 1000;
export function resolveOutboundSenderAccount(account) {
    return account.botId || undefined;
}
const SLASH_HEALTH_CHECK_RE = /^\/yuanbao-health-check(?:\s+(\d{1,2}:\d{2})(?:\s+(\d{1,2}:\d{2}))?)?\s*$/;
export function rewriteSlashCommand(text, onRewrite) {
    const trimmed = text.trim();
    const match = SLASH_HEALTH_CHECK_RE.exec(trimmed);
    if (!match)
        return text;
    const startTime = match[1];
    const endTime = match[2];
    const result = (startTime && endTime)
        ? `查询 openclaw 系统 [yuanbao channel] 从${startTime}到${endTime}时间段内的 warn 和 error 日志`
        : '查询 openclaw 系统 [yuanbao channel] 过去10分钟内的 warn 和 error 日志';
    const prompt = `
    ${result}

    **要求**：
    - 不要输出你的思考过程
    - 只列出日志摘要，不用分析代码层面的问题。
    - 输出格式为纯文本，不要任何 Markdown 语法。
    - 每条日志摘要占一行，行首不需要任何符号。
  `;
    onRewrite?.(text, prompt);
    return prompt;
}
