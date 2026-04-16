/**
 * LightClaw — Text Processing
 *
 * 封装传输层元数据剥离和文件附件信息提取逻辑。
 * 用于将 OpenClaw 注入的传输层前缀/后缀从用户消息中清除，
 * 以及从原始消息文本中提取文件附件信息。
 */
// ============================================================
// 传输元数据剥离
// ============================================================
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
export function stripTransportMetadata(text) {
    if (!text)
        return text;
    // ── 第一层：锚点截断 ──
    const hasUntrustedMeta = text.includes("(untrusted metadata)");
    if (hasUntrustedMeta) {
        const metaBlockRe = /\w[\w ]*\(untrusted metadata\):\s*```json\s*\{[^}]*\}\s*```/gs;
        let lastEnd = -1;
        let m;
        while ((m = metaBlockRe.exec(text)) !== null) {
            lastEnd = m.index + m[0].length;
        }
        if (lastEnd > 0 && lastEnd < text.length) {
            const userPart = text.slice(lastEnd).replace(/^\s+/, "");
            if (userPart) {
                return stripResidualMetadata(userPart);
            }
        }
    }
    // ── 第二层（后备）：逐条正则剥离 ──
    return stripResidualMetadata(text);
}
/**
 * 剥离残留的传输层元数据片段。
 *
 * 用于：
 *   1. 锚点截断后的残余清理
 *   2. 不含 untrusted metadata 的消息的后备剥离
 */
export function stripResidualMetadata(text) {
    if (!text)
        return text;
    let result = text;
    // 移除 [media attached: ...] 行
    result = result.replace(/^\[media attached:.*?\]\s*$/gm, "");
    // 移除 "To send an image back, ..." 指令块
    result = result.replace(/^To send an image back,.*?(?:Keep caption in the text body\.)\s*/gms, "");
    // 移除 Xxx (untrusted metadata): ```json ... ``` 块
    result = result.replace(/^\w[\w ]*\(untrusted metadata\):\s*```json\s*\{[^}]*\}\s*```\s*/gms, "");
    // 移除 Xxx (operator configured): 后跟编号列表的块
    result = result.replace(/^\w[\w ]*\(operator configured\):[\s\S]*?(?=\n\n(?![ \t]*\d+\.)|\n*$)/gm, "");
    // 移除 HEARTBEAT_OK 行
    result = result.replace(/^HEARTBEAT_OK\s*$/gm, "");
    // 移除 System: [...] 异步任务完成回调通知行
    result = result.replace(/^System:\s*\[.*?\].*$/gm, "");
    // 移除 [message_id: uuid] 标签（LightClaw 服务端在消息末尾追加的追踪标签）
    result = result.replace(/\n?\[message_id:\s*[^\]]+\]\s*$/gm, "");
    // 移除内联 <file ...>...</file> 标签及其内容
    result = result.replace(/<file\b[^>]*>.*?<\/file>/gs, "");
    // 移除 "用户发送了文件: filename (size)" 描述文本
    result = result.replace(/用户发送了文件:\s*.+?\s*\([^)]+\)\s*/g, "");
    return result.trim();
}
// ============================================================
// 文件附件提取
// ============================================================
/**
 * 从用户消息文本中提取文件附件信息。
 *
 * 匹配 "用户发送了文件: xxx.png (3.0KB)" 格式。
 * 以及 [media attached: .../name---uuid.ext (mime/type) | file://...] 格式。
 */
export function extractFileAttachments(text) {
    const files = [];
    // 从 "用户发送了文件: filename (size)" 提取
    const userFileRe = /用户发送了文件:\s*(.+?)\s*\(([^)]+)\)/g;
    let match;
    while ((match = userFileRe.exec(text)) !== null) {
        files.push({ name: match[1], size: match[2] });
    }
    // 从 [media attached: path (mime/type) | URI] 提取 MIME 和 URI
    // URI 可能含空格（如中文文件名经 URL encode 前的原始形式），所以用 [^\]]+ 而非 \S+
    const mediaRe = /\[media attached:\s*\S+\s*\(([^)]+)\)\s*\|\s*([^\]]+?)\s*\]/g;
    let mediaIdx = 0;
    while ((match = mediaRe.exec(text)) !== null) {
        const mimeType = match[1];
        const uri = match[2].trim();
        if (mediaIdx < files.length) {
            files[mediaIdx].mimeType = mimeType;
            files[mediaIdx].uri = uri;
        }
        else {
            const uriFileName = uri.split("/").pop()?.replace(/---[0-9a-f-]+\./, ".") || "file";
            files.push({ name: uriFileName, mimeType, uri });
        }
        mediaIdx++;
    }
    return files;
}
/**
 * 文件去重（按文件名）
 */
export function deduplicateFiles(files) {
    const seen = new Map();
    for (const f of files) {
        const existing = seen.get(f.name);
        if (existing) {
            if (!existing.mimeType && f.mimeType)
                existing.mimeType = f.mimeType;
            if (!existing.size && f.size)
                existing.size = f.size;
            if (!existing.uri && f.uri)
                existing.uri = f.uri;
        }
        else {
            seen.set(f.name, { ...f });
        }
    }
    return [...seen.values()];
}
//# sourceMappingURL=text-processing.js.map