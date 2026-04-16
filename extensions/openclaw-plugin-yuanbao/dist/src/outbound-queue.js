import { createLog } from './logger.js';
import { sendYuanbaoMessage, sendYuanbaoGroupMessage, sendMsgBodyDirect } from './message-handler/outbound.js';
import { stripOuterMarkdownFence } from './message-handler/context.js';
import { getCachedSticker } from './sticker/sticker-cache.js';
import { sendStickerYuanbao } from './sticker/sticker-sender.js';
import { getYuanbaoRuntime } from './runtime.js';
import { buildFileMsgBody, buildImageMsgBody, downloadAndUploadMedia, guessMimeType } from './media.js';
import { createReplyHeartbeatController } from './module/reply-heartbeat.js';
const activeManagers = new Map();
export function initOutboundQueue(accountId, config) {
    const log = createLog('outbound-queue');
    log.info(`[${accountId}] 初始化出站队列管理器，策略: ${config.strategy}`);
    const manager = createManager(config);
    activeManagers.set(accountId, manager);
    return manager;
}
export function getOutboundQueue(accountId) {
    return activeManagers.get(accountId) ?? null;
}
export function destroyOutboundQueue(accountId) {
    if (activeManagers.has(accountId)) {
        activeManagers.delete(accountId);
        const log = createLog('outbound-queue');
        log.info(`[${accountId}] 出站队列管理器已销毁`);
    }
}
function defaultChunkText(text, max) {
    if (text.length <= max)
        return [text];
    const chunks = [];
    for (let i = 0; i < text.length; i += max) {
        chunks.push(text.slice(i, i + max));
    }
    return chunks;
}
function createManager(config) {
    const { strategy } = config;
    const baseChunkText = config.chunkText ?? defaultChunkText;
    const mergeTextOpts = {
        minChars: config.minChars ?? 2800,
        maxChars: config.maxChars ?? 3000,
        chunkText: (text, max) => chunkMarkdownTextAtomicAware(text, max, baseChunkText),
    };
    const sessions = new Map();
    const log = createLog('outbound-queue');
    const core = getYuanbaoRuntime();
    return {
        strategy,
        registerSession(sessionKey, options) {
            const existing = sessions.get(sessionKey);
            if (existing) {
                log.warn(`[${sessionKey}] 覆盖已有未完成的 session (msgId=${existing.msgId})，先中止旧 session`);
                existing.abort();
            }
            const onComplete = () => sessions.delete(sessionKey);
            const { chatType, account, target, fromAccount, refMsgId, refFromAccount, ctx, msgId, mergeOnFlush, toAccount, } = options;
            const heartbeatTarget = (toAccount ?? (chatType === 'c2c' ? target : '')).trim();
            const heartbeatGroupCode = chatType === 'group' ? target : undefined;
            const sendText = async (text) => {
                log.info('sendText', { chatType, fromAccount, target });
                try {
                    const result = chatType === 'group'
                        ? await sendYuanbaoGroupMessage({
                            account,
                            groupCode: target,
                            text,
                            fromAccount,
                            refMsgId,
                            refFromAccount,
                            ctx,
                        })
                        : await sendYuanbaoMessage({ account, toAccount: target, text, fromAccount, ctx });
                    return { ok: result.ok, error: result.error };
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    log.error(`sendText failed: ${errMsg}`, { chatType, fromAccount, target });
                    return { ok: false, error: errMsg };
                }
            };
            const sendSticker = async (id) => {
                log.info('sendSticker', { chatType, fromAccount, target });
                try {
                    const sticker = getCachedSticker(id);
                    if (!sticker) {
                        return { ok: false, error: `sticker not found: ${id}` };
                    }
                    const result = await sendStickerYuanbao({
                        account,
                        config,
                        wsClient: ctx.wsClient,
                        toAccount: chatType === 'group' ? `group:${target}` : target,
                        sticker,
                        core,
                        refMsgId,
                        traceContext: ctx.traceContext,
                    });
                    return { ok: result.ok, error: result.error };
                }
                catch (e) {
                    const errMsg = e instanceof Error ? e.message : String(e);
                    log.error(`sendSticker failed: ${errMsg}`, { chatType, fromAccount, target });
                    return { ok: false, error: errMsg };
                }
            };
            const sendMedia = async (url, fallbackText) => {
                log.info('sendMedia', { chatType, fromAccount, target });
                const isGroup = chatType === 'group';
                try {
                    const uploadResult = await downloadAndUploadMedia(url, core, account);
                    const mime = guessMimeType(uploadResult.filename);
                    const msgBody = mime.startsWith('image/')
                        ? buildImageMsgBody({ url: uploadResult.url, filename: uploadResult.filename, size: uploadResult.size, uuid: uploadResult.uuid, imageInfo: uploadResult.imageInfo })
                        : buildFileMsgBody({ url: uploadResult.url, filename: uploadResult.filename, size: uploadResult.size, uuid: uploadResult.uuid });
                    const result = await sendMsgBodyDirect({
                        account,
                        config,
                        target: isGroup ? `group:${target}` : target,
                        msgBody: msgBody,
                        wsClient: ctx.wsClient,
                        core,
                        ...(isGroup ? { refMsgId, refFromAccount } : {}),
                        traceContext: ctx.traceContext,
                    });
                    return { ok: result.ok, error: result.error };
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    log.error(`sendMedia failed: ${errMsg}`, { chatType, fromAccount, target });
                    const fallback = fallbackText ? `${fallbackText}\n${url}` : url;
                    return isGroup
                        ? sendYuanbaoGroupMessage({
                            account,
                            groupCode: target,
                            text: fallback,
                            fromAccount: fromAccount || account.botId,
                            refMsgId,
                            refFromAccount,
                            ctx,
                        })
                        : sendYuanbaoMessage({
                            account,
                            toAccount: target,
                            text: fallback,
                            fromAccount: fromAccount || account.botId,
                            ...(isGroup ? { refMsgId, refFromAccount } : {}),
                            ctx,
                        });
                }
            };
            let session;
            if (mergeOnFlush) {
                session = createMergeOnFlushSession({ sendText, sendSticker, sendMedia }, msgId, onComplete, log, {
                    ctx,
                    account,
                    toAccount: heartbeatTarget,
                    groupCode: heartbeatGroupCode,
                });
            }
            else {
                switch (strategy) {
                    case 'immediate':
                        session = createImmediateSession({ sendText, sendSticker, sendMedia }, msgId, onComplete, log, {
                            ctx,
                            account,
                            toAccount: heartbeatTarget,
                            groupCode: heartbeatGroupCode,
                        });
                        break;
                    case 'merge-text':
                        session = createMergeTextSession({ sendText, sendSticker, sendMedia }, msgId, sessionKey, onComplete, log, mergeTextOpts, {
                            ctx,
                            account,
                            toAccount: heartbeatTarget,
                            groupCode: heartbeatGroupCode,
                        });
                        break;
                    default:
                        throw new Error(`未知的出站队列策略: ${strategy}`);
                }
            }
            sessions.set(sessionKey, session);
            log.debug(`[${sessionKey}] 注册会话队列，策略: ${mergeOnFlush ? 'mergeOnFlush' : strategy}，msgId: ${msgId}`);
            return session;
        },
        getSession(sessionKey) {
            return sessions.get(sessionKey) ?? null;
        },
        getOrCreateSession(sessionKey, options) {
            log.info(`[${sessionKey}:${options.target}] 获取或创建会话队列`);
            const existing = sessions.get(sessionKey);
            if (existing)
                return existing;
            log.debug(`[${sessionKey}] 自动创建轻量 session（委托 registerSession）`);
            return this.registerSession(sessionKey, {
                ...options,
                msgId: `auto-${Date.now()}`,
            });
        },
        unregisterSession(sessionKey) {
            sessions.delete(sessionKey);
        },
    };
}
function createImmediateSession(callbacks, msgId, onComplete, log, heartbeatMeta) {
    const { sendText, sendSticker, sendMedia } = callbacks;
    let aborted = false;
    let sendChain = Promise.resolve();
    let hasSentContent = false;
    const replyHeartbeat = createReplyHeartbeatController({ meta: heartbeatMeta });
    return {
        strategy: 'immediate',
        msgId,
        push(item) {
            if (aborted)
                return Promise.resolve();
            sendChain = sendChain.then(async () => {
                if (aborted)
                    return;
                let result;
                if (item.type === 'text') {
                    if (!item.text.trim())
                        return;
                    result = await sendText(item.text);
                    if (!result.ok) {
                        log.error(`immediate 发送文本失败: ${result.error}`);
                    }
                    else {
                        hasSentContent = true;
                        replyHeartbeat.onReplySent();
                    }
                }
                else if (item.type === 'sticker') {
                    const result = await sendSticker(item.sticker_id, item.text);
                    if (!result.ok) {
                        log.error(`immediate 发送表情失败: ${result.error}`);
                    }
                    else {
                        hasSentContent = true;
                        replyHeartbeat.onReplySent();
                    }
                }
                else {
                    const result = await sendMedia(item.mediaUrl, item.text, undefined, item.mediaLocalRoots);
                    if (!result.ok) {
                        log.error(`immediate 发送媒体失败: ${result.error}`);
                    }
                    else {
                        hasSentContent = true;
                        replyHeartbeat.onReplySent();
                    }
                }
                return result;
            });
            return sendChain;
        },
        async flush() {
            await sendChain;
            replyHeartbeat.stop();
            onComplete();
            return hasSentContent;
        },
        abort() {
            aborted = true;
            replyHeartbeat.stop();
            onComplete();
        },
        emitReplyHeartbeat(heartbeat) {
            replyHeartbeat.emit(heartbeat);
        },
        drainNow() {
            return sendChain;
        },
    };
}
function createMergeOnFlushSession(callbacks, msgId, onComplete, log, heartbeatMeta) {
    const { sendText, sendSticker, sendMedia } = callbacks;
    let aborted = false;
    const collectedTexts = [];
    const collectedStickers = [];
    const collectedMedias = [];
    let hasSentContent = false;
    const replyHeartbeat = createReplyHeartbeatController({ meta: heartbeatMeta });
    return {
        strategy: 'immediate',
        msgId,
        push(item) {
            if (aborted)
                return Promise.resolve();
            if (item.type === 'text') {
                if (item.text.trim())
                    collectedTexts.push(item.text);
            }
            else if (item.type === 'sticker') {
                collectedStickers.push({ stickerId: item.sticker_id, text: item.text });
            }
            else {
                collectedMedias.push({ mediaUrl: item.mediaUrl, text: item.text, mediaLocalRoots: item.mediaLocalRoots });
            }
            return Promise.resolve();
        },
        async flush() {
            if (aborted)
                return hasSentContent;
            if (collectedTexts.length > 0) {
                const merged = stripOuterMarkdownFence(collectedTexts.join(''));
                collectedTexts.length = 0;
                if (merged.trim()) {
                    const result = await sendText(merged);
                    if (!result.ok) {
                        log.error(`mergeOnFlush 发送合并文本失败: ${result.error}`);
                    }
                    else {
                        hasSentContent = true;
                        replyHeartbeat.onReplySent();
                    }
                }
            }
            for (const sticker of collectedStickers) {
                if (aborted)
                    break;
                const result = await sendSticker(sticker.stickerId, sticker.text);
                if (!result.ok) {
                    log.error(`mergeOnFlush 发送表情失败: ${result.error}`);
                }
                else {
                    hasSentContent = true;
                }
            }
            for (const media of collectedMedias) {
                if (aborted)
                    break;
                const result = await sendMedia(media.mediaUrl, media.text, undefined, media.mediaLocalRoots);
                if (!result.ok) {
                    log.error(`mergeOnFlush 发送媒体失败: ${result.error}`);
                }
                else {
                    hasSentContent = true;
                    replyHeartbeat.onReplySent();
                }
            }
            collectedTexts.length = 0;
            collectedMedias.length = 0;
            collectedStickers.length = 0;
            replyHeartbeat.stop();
            onComplete();
            return hasSentContent;
        },
        abort() {
            aborted = true;
            collectedTexts.length = 0;
            collectedMedias.length = 0;
            replyHeartbeat.stop();
            onComplete();
        },
        emitReplyHeartbeat(heartbeat) {
            replyHeartbeat.emit(heartbeat);
        },
        drainNow() {
            return Promise.resolve();
        },
    };
}
export function endsWithTableRow(text) {
    const trimmed = text.trimEnd();
    if (!trimmed)
        return false;
    const lastLine = trimmed.split('\n').at(-1) ?? '';
    const line = lastLine.trim();
    return line.startsWith('|') && line.endsWith('|');
}
export function hasUnclosedFence(text) {
    let inFence = false;
    for (const line of text.split('\n')) {
        if (line.startsWith('```'))
            inFence = !inFence;
    }
    return inFence;
}
export function startsWithBlockElement(text) {
    const firstLine = (text.trimStart().split('\n')[0] ?? '').trimStart();
    return /^#{1,6}\s/.test(firstLine)
        || firstLine.startsWith('---')
        || firstLine.startsWith('***')
        || firstLine.startsWith('___')
        || firstLine.startsWith('> ')
        || firstLine.startsWith('```')
        || /^[*\-+]\s/.test(firstLine)
        || /^\d+[.)]\s/.test(firstLine)
        || firstLine.startsWith('|');
}
export function inferBlockSeparator(buffer, incoming) {
    if (hasUnclosedFence(buffer))
        return '';
    if (buffer.endsWith('\n\n'))
        return '';
    const lastLine = (buffer.trimEnd().split('\n')
        .at(-1) ?? '').trim();
    const firstLine = (incoming.trimStart().split('\n')[0] ?? '').trimStart();
    if (lastLine.startsWith('|') && !firstLine.startsWith('|')
        && firstLine.endsWith('|')) {
        return ' ';
    }
    if (lastLine.startsWith('|') && firstLine.startsWith('|'))
        return '\n';
    if (startsWithBlockElement(incoming))
        return '\n\n';
    return '';
}
const DIAGRAM_LANGUAGES = new Set([
    'mermaid', 'plantuml', 'sequence', 'flowchart',
    'gantt', 'classdiagram', 'statediagram', 'erdiagram',
    'journey', 'gitgraph', 'mindmap', 'timeline',
]);
export function extractAtomicBlocks(text) {
    const blocks = [];
    const lines = text.split('\n');
    let offset = 0;
    let inPlainFence = false;
    let inDiagram = false;
    let diagramStart = 0;
    let tableStart = -1;
    let tableEnd = -1;
    let tableHasSep = false;
    let tableLineCount = 0;
    const isTableLine = (line) => line.trim().startsWith('|');
    const isTableSeparator = (line) => /^\|[\s|:-]+\|$/.test(line.trim());
    const flushTable = () => {
        if (tableStart !== -1 && tableEnd !== -1 && (tableHasSep || tableLineCount >= 2)) {
            blocks.push({ start: tableStart, end: tableEnd, kind: 'table' });
        }
        tableStart = -1;
        tableEnd = -1;
        tableHasSep = false;
        tableLineCount = 0;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineEnd = offset + line.length + (i < lines.length - 1 ? 1 : 0);
        if (inPlainFence || inDiagram) {
            if (line.startsWith('```')) {
                if (inDiagram) {
                    blocks.push({ start: diagramStart, end: lineEnd, kind: 'diagram-fence' });
                    inDiagram = false;
                }
                else {
                    inPlainFence = false;
                }
            }
            offset = lineEnd;
            continue;
        }
        if (line.startsWith('```')) {
            flushTable();
            const lang = line.slice(3).trim()
                .toLowerCase();
            if (lang && DIAGRAM_LANGUAGES.has(lang)) {
                inDiagram = true;
                diagramStart = offset;
            }
            else {
                inPlainFence = true;
            }
            offset = lineEnd;
            continue;
        }
        if (isTableLine(line)) {
            if (tableStart === -1) {
                tableStart = offset;
                tableLineCount = 1;
                tableHasSep = false;
            }
            else {
                tableLineCount++;
                if (!tableHasSep && tableLineCount === 2 && isTableSeparator(line)) {
                    tableHasSep = true;
                }
            }
            tableEnd = lineEnd;
        }
        else {
            flushTable();
        }
        offset = lineEnd;
    }
    flushTable();
    return blocks.sort((a, b) => a.start - b.start);
}
export function chunkMarkdownTextAtomicAware(text, maxChars, chunkFn) {
    const rawChunks = chunkFn(text, maxChars);
    if (rawChunks.length <= 1)
        return rawChunks;
    const atomicBlocks = extractAtomicBlocks(text);
    if (atomicBlocks.length === 0)
        return rawChunks;
    const splitIndices = [];
    let cumLen = 0;
    for (let i = 0; i < rawChunks.length - 1; i++) {
        cumLen += rawChunks[i].length;
        splitIndices.push(cumLen);
    }
    const adjustedIndices = [];
    let chunkWindowStart = 0;
    for (const idx of splitIndices) {
        const block = atomicBlocks.find(b => b.start < idx && idx < b.end);
        if (!block) {
            adjustedIndices.push(idx);
            chunkWindowStart = idx;
            continue;
        }
        if (block.start > chunkWindowStart) {
            adjustedIndices.push(block.start);
            chunkWindowStart = block.start;
        }
        else {
            adjustedIndices.push(block.end);
            chunkWindowStart = block.end;
        }
    }
    const result = [];
    let prev = 0;
    for (const idx of adjustedIndices) {
        if (idx > prev)
            result.push(text.slice(prev, idx));
        prev = idx;
    }
    if (prev < text.length)
        result.push(text.slice(prev));
    return result.filter(c => c.length > 0);
}
export function mergeBlockStreamingFences(buffer, incoming) {
    const CLOSE_RE = /\n```\s*$/;
    const OPEN_RE = /^```[^\n]*\n/;
    const normalized = incoming.replace(/\n```\s*```[^\n]*\n/g, '\n');
    if (CLOSE_RE.test(buffer) && OPEN_RE.test(normalized)) {
        return `${buffer.replace(CLOSE_RE, '')}\n${normalized.replace(OPEN_RE, '')}`;
    }
    if (hasUnclosedFence(buffer) && OPEN_RE.test(normalized)) {
        return `${buffer}\n${normalized.replace(OPEN_RE, '')}`;
    }
    return `${buffer}${normalized}`;
}
function createMergeTextSession(callbacks, msgId, sessionKey, onComplete, log, opts, heartbeatMeta) {
    const { sendText, sendSticker, sendMedia } = callbacks;
    const { minChars, maxChars, chunkText } = opts;
    let aborted = false;
    let textBuffer = '';
    let sendChain = Promise.resolve();
    let hasSentContent = false;
    const replyHeartbeat = createReplyHeartbeatController({ meta: heartbeatMeta });
    async function drainBuffer(force) {
        if (textBuffer.length === 0)
            return;
        const chunks = chunkText(textBuffer, maxChars);
        log.debug(`[${sessionKey}] drainBuffer force=${force}: inputLen=${textBuffer.length}, chunks=${chunks.length}`);
        if (force || chunks.length <= 1) {
            if (!force && chunks.length === 1 && hasUnclosedFence(chunks[0])) {
                log.debug(`[${sessionKey}] drainBuffer: single chunk has unclosed fence, keeping in buffer (bufLen=${textBuffer.length})`);
                return;
            }
            if (!force && chunks.length === 1 && endsWithTableRow(chunks[0])) {
                log.debug(`[${sessionKey}] drainBuffer: single chunk ends with table row, keeping in buffer for continuation (bufLen=${textBuffer.length})`);
                return;
            }
            if (!force && chunks.length === 1 && textBuffer.length < minChars) {
                log.debug(`[${sessionKey}] drainBuffer: bufLen=${textBuffer.length} < minChars=${minChars}, waiting for more content`);
                return;
            }
            textBuffer = '';
            for (const chunk of chunks) {
                if (aborted)
                    return;
                if (!chunk.trim())
                    continue;
                log.debug(`[${sessionKey}] emit chunk(force=${force}): len=${chunk.length} head=${JSON.stringify(chunk.slice(0, 3))} tail=${JSON.stringify(chunk.slice(-3))}`);
                const result = await sendText(chunk);
                if (!result.ok)
                    log.error(`[${sessionKey}] send failed: ${result.error}`);
            }
        }
        else {
            const toSend = chunks.slice(0, -1);
            textBuffer = chunks[chunks.length - 1];
            log.debug(`[${sessionKey}] drainBuffer: sending ${toSend.length} chunk(s), remainder len=${textBuffer.length}`);
            for (const chunk of toSend) {
                if (aborted)
                    return;
                if (!chunk.trim())
                    continue;
                log.debug(`[${sessionKey}] emit chunk(split): len=${chunk.length} head=${JSON.stringify(chunk.slice(0, 3))} tail=${JSON.stringify(chunk.slice(-3))}`);
                const result = await sendText(chunk);
                if (!result.ok) {
                    log.error(`[${sessionKey}] merge-text send failed: ${result.error}`);
                }
                else {
                    hasSentContent = true;
                    replyHeartbeat.onReplySent();
                }
            }
        }
    }
    return {
        strategy: 'merge-text',
        msgId,
        push(item) {
            if (aborted)
                return Promise.resolve();
            sendChain = sendChain.then(async () => {
                if (aborted)
                    return;
                if (item.type === 'text') {
                    if (!item.text.trim())
                        return;
                    if (textBuffer) {
                        const separator = inferBlockSeparator(textBuffer, item.text);
                        textBuffer = mergeBlockStreamingFences(separator ? `${textBuffer}${separator}` : textBuffer, item.text);
                    }
                    else {
                        textBuffer = item.text;
                    }
                    log.debug(`[${sessionKey}] merge-text push: bufLen=${textBuffer.length}`);
                    hasSentContent = true;
                    await drainBuffer(false);
                }
                else {
                    if (textBuffer.length > 0) {
                        log.debug(`[${sessionKey}] merge-text media push: flushing text buffer first, bufLen=${textBuffer.length}`);
                        await drainBuffer(true);
                    }
                    if (aborted)
                        return;
                    let result;
                    if (item.type === 'sticker') {
                        result = await sendSticker(item.sticker_id, item.text);
                    }
                    else {
                        result = await sendMedia(item.mediaUrl, item.text, 'image', item.mediaLocalRoots);
                    }
                    if (!result.ok) {
                        log.error(`[${sessionKey}] merge-text send failed: ${result.error}`);
                    }
                    else {
                        hasSentContent = true;
                        replyHeartbeat.onReplySent();
                    }
                }
            });
            return sendChain;
        },
        async flush() {
            log.debug(`[${sessionKey}] merge-text session flush: bufLen=${textBuffer.length}`);
            await sendChain;
            if (aborted)
                return hasSentContent;
            textBuffer = stripOuterMarkdownFence(textBuffer);
            await drainBuffer(true);
            replyHeartbeat.stop();
            onComplete();
            return hasSentContent;
        },
        abort() {
            const bufLen = textBuffer.length;
            log.info(`[${sessionKey}] merge-text session aborted, discarding bufLen=${bufLen}`);
            aborted = true;
            textBuffer = '';
            replyHeartbeat.stop();
            onComplete();
        },
        emitReplyHeartbeat(heartbeat) {
            replyHeartbeat.emit(heartbeat);
        },
        drainNow() {
            if (aborted || !textBuffer)
                return Promise.resolve();
            sendChain = sendChain.then(async () => {
                if (aborted || !textBuffer)
                    return;
                log.debug(`[${sessionKey}] drainNow: force flushing bufLen=${textBuffer.length} before tool call`);
                await drainBuffer(true);
            });
            return sendChain;
        },
    };
}
export { createMergeTextSession as createMergeTextSessionForTest };
