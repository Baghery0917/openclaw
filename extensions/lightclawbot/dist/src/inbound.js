/**
 * LightClaw — 入站消息处理
 *
 * 接收用户消息 → 文件处理 → 路由 → AI 分发 → 回复
 */
import { getAssistantRuntime } from "./runtime.js";
import { CHANNEL_KEY, REPLY_TIMEOUT, MEDIA_MAX_BYTES, resolveEffectiveApiKey, setSessionApiKey } from "./config.js";
import { createChannelReplyPipeline } from "openclaw/plugin-sdk/channel-reply-pipeline";
import { generateMsgId } from "./dedup.js";
import { parseDataUrl, formatFileSize, mediaUrlsToFiles } from "./media.js";
import { uploadFileToCos, downloadFileFromCos, getFileDownloadUrl } from "./file-storage.js";
/**
 * 创建入站消息处理器
 */
export function createInboundHandler(account, emitter, log) {
    return async (msg) => {
        const pluginRuntime = getAssistantRuntime();
        const currentCfg = pluginRuntime.config.loadConfig();
        // 根据 senderId(=uin) 获取对应的 apiKey（多 key 模式下按 uin 选 key，单 key 模式下 fallback 到主 key）
        const effectiveApiKey = resolveEffectiveApiKey({ senderId: msg.senderId });
        log?.info(`[${CHANNEL_KEY}] Effective API key for uin ${msg.senderId}: ${effectiveApiKey.slice(0, 8)}...`);
        // 1. 确定地址和会话 Key
        // 使用标准 user: 前缀，与 normalizeTarget 输出格式一致
        const fromAddress = `user:${msg.senderId}`;
        // 2. 路由解析
        const route = pluginRuntime.channel.routing.resolveAgentRoute({
            cfg: currentCfg,
            channel: CHANNEL_KEY,
            accountId: account.accountId,
            peer: { kind: "direct", id: msg.senderId },
        });
        // 3. 权限检查
        const commandAuthorized = checkAuth(account.allowFrom, account.dmPolicy, msg.senderId);
        // 3.5 记录 sessionKey → apiKey 映射（tool 执行时通过 ctx.sessionKey 直接获取对应 apiKey）
        // 注意：只写入 per-channel-peer 的 sessionKey，不写入 mainSessionKey。
        // mainSessionKey（= "agent:main:main"）是全局共享的，所有用户消息都会覆盖它，
        // 导致最后一个用户的 apiKey 覆盖前一个用户，产生并发安全问题。
        if (route?.sessionKey) {
            setSessionApiKey(route.sessionKey, effectiveApiKey);
        }
        // 4. 处理文件附件（files[] → 本地存储）
        const localMediaPaths = [];
        const localMediaTypes = [];
        // 每个文件对应的公网可访问 URL，用于 session 历史持久化
        const publicMediaUrls = [];
        const ctxAttachments = [];
        let attachmentDescription = "";
        for (const file of msg.files) {
            try {
                let buffer;
                let mimeType;
                // 记录文件的公网 URL，优先用于 session 存储
                let cosPublicUrl;
                const parsed = file.bytes ? parseDataUrl(file.bytes) : null;
                if (parsed) {
                    // data URL 格式：直接解析
                    buffer = parsed.buffer;
                    mimeType = parsed.mimeType;
                }
                else if (file.uri) {
                    // 远程 URI（下载地址），下载获取内容
                    log?.info(`[${CHANNEL_KEY}] File has URI, downloading from cloud: ${file.uri}`);
                    const downloaded = await downloadFileFromCos(file.uri, { apiKey: effectiveApiKey });
                    buffer = downloaded.buffer;
                    mimeType = file.mimeType;
                    // 保留原始公网 URL，用于 session 历史中持久化引用
                    cosPublicUrl = file.uri.startsWith("http")
                        ? file.uri
                        : getFileDownloadUrl(file.uri);
                }
                else {
                    log?.warn(`[${CHANNEL_KEY}] File has no bytes or uri: ${file.name}, skipping`);
                    continue;
                }
                const saved = await pluginRuntime.channel.media.saveMediaBuffer(buffer, mimeType, "inbound", MEDIA_MAX_BYTES, file.name);
                localMediaPaths.push(saved.path);
                localMediaTypes.push(mimeType);
                // 如果文件来自云端，使用公网 URL；否则尝试上传获取公网 URL
                if (cosPublicUrl) {
                    publicMediaUrls.push(cosPublicUrl);
                }
                else {
                    // data URL 来源的文件：上传到云端以获取公网 URL
                    try {
                        const uploadResult = await uploadFileToCos(saved.path, { apiKey: effectiveApiKey });
                        publicMediaUrls.push(uploadResult.url || `file://${saved.path}`);
                        log?.info(`[${CHANNEL_KEY}] Uploaded inbound file to cloud: ${saved.path} → ${uploadResult.url}`);
                    }
                    catch (uploadErr) {
                        log?.warn(`[${CHANNEL_KEY}] Failed to upload inbound file, falling back to local path: ${uploadErr}`);
                        publicMediaUrls.push(`file://${saved.path}`);
                    }
                }
                // Attachments 中使用公网 URL，确保 session 历史中的地址可被前端访问
                const attachmentUrl = publicMediaUrls[publicMediaUrls.length - 1];
                ctxAttachments.push({
                    name: file.name,
                    mimeType,
                    url: attachmentUrl,
                });
                attachmentDescription += `\n用户发送了文件: ${file.name} (${formatFileSize(saved.size)})`;
                log?.info(`[${CHANNEL_KEY}] File saved: ${saved.path} (${mimeType}, ${formatFileSize(saved.size)}), publicUrl: ${attachmentUrl}`);
            }
            catch (err) {
                log?.error(`[${CHANNEL_KEY}] File processing failed for ${file.name}: ${err}`);
            }
        }
        // 5. 构建消息体
        const userText = msg.text + attachmentDescription;
        const agentBody = account.systemPrompt
            ? `${account.systemPrompt}\n\n${userText}`
            : userText;
        // 6. 构建入站上下文
        // MediaPaths 保持本地路径（AI 模型 vision 需要从本地读取文件内容）
        // MediaUrls 使用公网 URL（session 历史持久化，前端可直接访问）
        const mediaFields = {};
        if (localMediaPaths.length > 0) {
            mediaFields.MediaPaths = localMediaPaths;
            mediaFields.MediaPath = localMediaPaths[0];
            mediaFields.MediaTypes = localMediaTypes;
            mediaFields.MediaType = localMediaTypes[0];
            mediaFields.MediaUrls = publicMediaUrls;
            mediaFields.MediaUrl = publicMediaUrls[0];
        }
        const ctxPayload = pluginRuntime.channel.reply.finalizeInboundContext({
            Body: userText,
            BodyForAgent: agentBody,
            RawBody: msg.text,
            CommandBody: msg.text,
            From: fromAddress,
            To: `${CHANNEL_KEY}:${account.accountId}`,
            Channel: CHANNEL_KEY,
            ChatType: "direct",
            SessionKey: route?.sessionKey ?? fromAddress,
            AccountId: route?.accountId ?? account.accountId,
            SenderId: msg.senderId,
            SenderName: msg.senderId,
            Provider: CHANNEL_KEY,
            Surface: CHANNEL_KEY,
            MessageSid: msg.messageId,
            Timestamp: msg.timestamp,
            OriginatingChannel: CHANNEL_KEY,
            OriginatingTo: fromAddress,
            CommandAuthorized: commandAuthorized,
            OwnerAllowFrom: commandAuthorized ? [msg.senderId, fromAddress] : undefined,
            AgentId: route?.agentId,
            Attachments: ctxAttachments.length > 0 ? ctxAttachments : undefined,
            ...mediaFields,
        });
        log?.info(`[${CHANNEL_KEY}] Inbound context: ${JSON.stringify(ctxPayload)}`);
        const targetId = msg.senderId;
        log?.info(`[${CHANNEL_KEY}] Processing: from=${msg.senderId} text="${(msg.text || "(仅文件)").slice(0, 60)}" files=${msg.files.length}`);
        // 6.5 更新 session 的 last route，使 cron 定时任务能找到 lightclawbot 的投递目标
        const storePath = pluginRuntime.channel.session.resolveStorePath(route.agentId);
        const deliveryCtx = {
            channel: CHANNEL_KEY,
            to: fromAddress,
            accountId: route.accountId ?? account.accountId,
        };
        // 写入 per-channel-peer session
        if (route?.sessionKey) {
            pluginRuntime.channel.session.updateLastRoute({
                storePath,
                sessionKey: route.sessionKey,
                deliveryContext: deliveryCtx,
            }).catch((err) => {
                log?.error(`[${CHANNEL_KEY}] Failed to update last route (session): ${err}`);
            });
        }
        // 写入 main session（兜底）
        if (route?.mainSessionKey && route.mainSessionKey !== route.sessionKey) {
            pluginRuntime.channel.session.updateLastRoute({
                storePath,
                sessionKey: route.mainSessionKey,
                deliveryContext: deliveryCtx,
            }).catch((err) => {
                log?.error(`[${CHANNEL_KEY}] Failed to update last route (main): ${err}`);
            });
        }
        // 7. 创建 replyPrefixOptions（使用 createChannelReplyPipeline 替代已移除的 createReplyPrefixOptions）
        const { onModelSelected, typingCallbacks: _tc, ...prefixOptions } = createChannelReplyPipeline({
            cfg: currentCfg,
            agentId: route.agentId,
            channel: CHANNEL_KEY,
            accountId: account.accountId,
        });
        // 8. 分发给 AI 引擎
        let hasResponse = false;
        let idleSent = false;
        let timeoutId = null;
        let timeoutFired = false;
        // 超时仅记录日志，不中断 dispatch（AI 可能仍在处理中）
        timeoutId = setTimeout(() => {
            if (!hasResponse) {
                timeoutFired = true;
                log?.warn(`[${CHANNEL_KEY}] AI reply not received within ${REPLY_TIMEOUT}ms, still waiting...`);
            }
        }, REPLY_TIMEOUT);
        // 同一条消息的流式回复（typing_start / stream_chunk / typing_stop）共用同一个 msgId
        const replyMsgId = generateMsgId();
        const dispatchPromise = pluginRuntime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: ctxPayload,
            cfg: currentCfg,
            dispatcherOptions: {
                ...prefixOptions,
                deliver: async (payload, info) => {
                    hasResponse = true;
                    log?.info(`[${CHANNEL_KEY}] Deliver: ${JSON.stringify(payload)}。info: ${JSON.stringify(info)}`);
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    const replyText = payload.text ?? payload.body ?? "";
                    const mediaList = payload.mediaUrls?.length
                        ? payload.mediaUrls
                        : payload.mediaUrl ? [payload.mediaUrl] : [];
                    // 流式中间块
                    if (info.kind === "block") {
                        if (replyText.trim()) {
                            emitter.emit({
                                msgId: replyMsgId,
                                from: emitter.botClientId,
                                to: targetId,
                                content: replyText,
                                timestamp: Date.now(),
                                replyToMsgId: msg.messageId,
                                kind: "stream_chunk",
                            });
                        }
                        return;
                    }
                    if (!replyText && !mediaList.length)
                        return;
                    // 发送媒体文件 — 同时上传到云端获取公网 URL
                    if (mediaList.length > 0) {
                        const files = await mediaUrlsToFiles(mediaList, log);
                        // 尝试将文件上传获取公网链接
                        const publicUrls = [];
                        const storageConfig = {
                            apiKey: effectiveApiKey,
                        };
                        for (const mediaUrl of mediaList) {
                            try {
                                // 本地文件路径（file:// 或绝对路径）
                                const localPath = mediaUrl.startsWith("file://")
                                    ? mediaUrl.slice(7)
                                    : mediaUrl;
                                if (localPath.startsWith("/") || localPath.match(/^[A-Za-z]:\\/)) {
                                    const { existsSync } = await import("node:fs");
                                    if (existsSync(localPath)) {
                                        const result = await uploadFileToCos(localPath, storageConfig);
                                        publicUrls.push(result.url || '');
                                        log?.info(`[${CHANNEL_KEY}] Uploaded to cloud: ${localPath} → ${result.url}`);
                                    }
                                }
                            }
                            catch (uploadErr) {
                                log?.warn(`[${CHANNEL_KEY}] Cloud upload failed for ${mediaUrl}: ${uploadErr}`);
                            }
                        }
                        // 将公网 URL 追加到回复文本中（Markdown 链接格式）
                        let enrichedText = replyText;
                        if (publicUrls.length > 0) {
                            const urlSection = publicUrls
                                .map((url, i) => {
                                // 从 URL 中提取文件名
                                const match = url.match(/filePath=([^&]+)/);
                                const filePath = match ? decodeURIComponent(match[1]) : "";
                                const fileName = filePath.split("/").pop() || `file${publicUrls.length > 1 ? ` (${i + 1})` : ""}`;
                                return `📎 [${fileName}](${url})`;
                            })
                                .join("\n");
                            enrichedText = enrichedText
                                ? `${enrichedText}\n\n${urlSection}`
                                : urlSection;
                        }
                        if (files.length > 0) {
                            emitter.sendFiles(targetId, enrichedText, files, msg.messageId);
                            return;
                        }
                        // 文件无法直接发送，但有公网 URL，用文本方式发送链接
                        if (enrichedText.trim()) {
                            emitter.sendReply(targetId, enrichedText, msg.messageId);
                            return;
                        }
                    }
                    // 发送文本回复
                    if (replyText.trim()) {
                        emitter.sendReply(targetId, replyText, msg.messageId);
                    }
                },
                onReplyStart: () => {
                    emitter.emit({
                        msgId: replyMsgId,
                        from: emitter.botClientId,
                        to: targetId,
                        content: "",
                        timestamp: Date.now(),
                        kind: "typing_start",
                    });
                },
                onIdle: () => {
                    if (idleSent)
                        return;
                    idleSent = true;
                    emitter.emit({
                        msgId: replyMsgId,
                        from: emitter.botClientId,
                        to: targetId,
                        content: "",
                        timestamp: Date.now(),
                        replyToMsgId: msg.messageId,
                        kind: "typing_stop",
                    });
                },
                onError: (err, info) => {
                    log?.error(`[${CHANNEL_KEY}] ${info.kind} reply failed: ${String(err)}`);
                },
            },
            replyOptions: { onModelSelected, disableBlockStreaming: false },
        });
        try {
            await dispatchPromise;
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log?.error(`[${CHANNEL_KEY}] Dispatch error: ${errMsg}`);
            // 只发送通用提示，不暴露内部错误细节给用户
            emitter.sendReply(targetId, '抱歉，处理您的消息时出现了问题，请稍后重试', msg.messageId);
        }
        finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (timeoutFired) {
                log?.info(`[${CHANNEL_KEY}] Note: dispatch completed after timeout warning (${hasResponse ? 'with' : 'without'} response)`);
            }
        }
    };
}
// ============================================================
// 权限检查
// ============================================================
function checkAuth(allowFrom, dmPolicy, senderId) {
    if (dmPolicy === "disabled")
        return false;
    if (dmPolicy === "open")
        return true;
    if (!allowFrom || allowFrom.length === 0)
        return false;
    return allowFrom.includes("*") || allowFrom.some((id) => id.toLowerCase() === senderId.toLowerCase());
}
//# sourceMappingURL=inbound.js.map