/**
 * LightClaw — ChannelPlugin 主定义
 *
 * 这是 OpenClaw 框架的「注册契约」：
 * 声明插件 ID、能力、配置管理、出站适配、Gateway 生命周期等。
 * 框架通过这个对象了解你的插件能做什么、怎么启动、怎么发消息。
 */
import { applyAccountNameToChannelSection, deleteAccountFromConfigSection, setAccountEnabledInConfigSection, } from "openclaw/plugin-sdk/core";
import { CHANNEL_KEY, DEFAULT_ACCOUNT_ID, TEXT_CHUNK_LIMIT, listAccountIds, resolveAccount, defaultAccountId, applyAccountConfig, } from "./config.js";
import { sendText, sendMedia } from "./outbound.js";
import { startGateway } from "./gateway.js";
/** 文本分块：按 limit 长度拆分，优先在换行 / 空格处切割 */
function chunkText(text, limit) {
    if (text.length <= limit)
        return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= limit) {
            chunks.push(remaining);
            break;
        }
        let splitAt = remaining.lastIndexOf("\n", limit);
        if (splitAt <= 0 || splitAt < limit * 0.5) {
            splitAt = remaining.lastIndexOf(" ", limit);
        }
        if (splitAt <= 0 || splitAt < limit * 0.5) {
            splitAt = limit;
        }
        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt).trimStart();
    }
    return chunks;
}
// ============================================================
// ChannelPlugin 定义
// ============================================================
export const myAssistantPlugin = {
    id: CHANNEL_KEY,
    // ---- 元信息 ----
    meta: {
        id: CHANNEL_KEY,
        label: "LightClawBot",
        selectionLabel: "LightClawBot",
        docsPath: "/docs/channels/lightclawbot",
        blurb: "Connect OpenClaw to your LightClawBot via WebSocket long-connection",
        order: 60,
    },
    // ---- 能力声明 ----
    capabilities: {
        chatTypes: ["direct"],
        media: true,
        reactions: false,
        threads: false,
        // true = deliver 回调会收到 kind="block" 的中间块，实现流式推送
        blockStreaming: true,
    },
    // ---- 配置管理（多账户） ----
    config: {
        listAccountIds: (cfg) => listAccountIds(cfg),
        resolveAccount: (cfg, accountId) => resolveAccount(cfg, accountId),
        defaultAccountId: (cfg) => defaultAccountId(cfg),
        setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
            cfg,
            sectionKey: CHANNEL_KEY,
            accountId,
            enabled,
            allowTopLevel: true,
        }),
        deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
            cfg,
            sectionKey: CHANNEL_KEY,
            accountId,
            clearBaseFields: ["apiKeys", "apiBaseUrl", "name"],
        }),
        isConfigured: (account) => Boolean(account?.allApiKeys?.length),
        describeAccount: (account) => ({
            accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
            name: account?.name,
            enabled: account?.enabled ?? false,
            configured: Boolean(account?.allApiKeys?.length),
            tokenSource: account?.secretSource,
        }),
        resolveAllowFrom: ({ cfg, accountId }) => {
            const account = resolveAccount(cfg, accountId);
            return account.allowFrom.map(String);
        },
    },
    // ---- Setup（命令行配置） ----
    setup: {
        resolveAccountId: ({ accountId }) => accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID,
        applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({ cfg, channelKey: CHANNEL_KEY, accountId, name }),
        validateInput: ({ input }) => {
            if (!input.token && !input.useEnv) {
                return "Requires --token <apiKey> or --use-env (set LIGHTCLAW_API_KEY, LIGHTCLAW_API_BASE_URL)";
            }
            return null;
        },
        applyAccountConfig: ({ cfg, accountId, input }) => {
            return applyAccountConfig(cfg, accountId, {
                apiKey: input.token,
                apiBaseUrl: input.apiBaseUrl,
                name: input.name,
            });
        },
    },
    // ---- 消息目标解析 ----
    // 使用标准 user:/channel: 前缀，确保框架的 detectTargetKind 能正确识别 peer kind
    messaging: {
        normalizeTarget: (target) => {
            // 剥离通道名前缀 (lightclawbot:)
            const cleaned = target.replace(new RegExp(`^${CHANNEL_KEY}:`, "i"), "");
            if (!cleaned)
                return undefined;
            // dm:xxx → user:xxx (私聊)
            if (cleaned.startsWith("dm:")) {
                return `user:${cleaned.slice(3)}`;
            }
            // group:xxx → channel:xxx (群聊)
            if (cleaned.startsWith("group:")) {
                return `channel:${cleaned.slice(6)}`;
            }
            // 已经是标准格式 user:/channel:，原样返回
            if (/^(user|channel):/i.test(cleaned)) {
                return cleaned;
            }
            // 纯 ID，默认当作私聊
            return `user:${cleaned}`;
        },
        targetResolver: {
            looksLikeId: (id, normalized) => {
                const value = (normalized ?? id).trim();
                if (!value)
                    return false;
                // 标准前缀格式
                if (/^(user|channel):/i.test(value))
                    return true;
                // lightclawbot 自有格式
                const cleaned = value.replace(new RegExp(`^${CHANNEL_KEY}:`, "i"), "");
                return /^(dm|group):\d+/.test(cleaned) || /^\d+$/.test(cleaned);
            },
            hint: `user:<userId> or channel:<groupId>`,
        },
    },
    // ---- 出站消息适配器 ----
    outbound: {
        deliveryMode: "direct",
        chunker: chunkText,
        chunkerMode: "markdown",
        textChunkLimit: TEXT_CHUNK_LIMIT,
        resolveTarget: ({ to, allowFrom, mode }) => {
            // 优先使用显式 to；implicit 模式下回退到 allowFrom 第一个非通配符条目
            const effectiveTo = to?.trim();
            if (effectiveTo) {
                return { ok: true, to: effectiveTo };
            }
            if (mode === "implicit" && allowFrom && allowFrom.length > 0) {
                const candidate = allowFrom.find((entry) => entry && entry !== "*");
                if (candidate) {
                    return { ok: true, to: candidate };
                }
            }
            return {
                ok: false,
                error: new Error(`No delivery target for ${CHANNEL_KEY}. Specify a target with --to or configure allowFrom.`),
            };
        },
        sendText: async ({ to, text, accountId, replyToId, cfg }) => {
            return sendText({ to, text, accountId, replyToId, cfg });
        },
        sendMedia: async ({ to, text, mediaUrl, accountId, replyToId, cfg }) => {
            return sendMedia({ to, text, mediaUrl, accountId, replyToId, cfg });
        },
    },
    // ---- Gateway 生命周期（核心！） ----
    gateway: {
        /**
         * 启动账户：建立 WS 长连接到你的 AI 助手 Server
         * OpenClaw 会在加载配置后为每个 enabled 的账户调用此方法
         */
        startAccount: async (ctx) => {
            const { account, abortSignal, log, cfg } = ctx;
            log?.info(`[${CHANNEL_KEY}:${account.accountId}] Starting gateway...`);
            await startGateway({
                account,
                abortSignal,
                cfg,
                log,
                onReady: () => {
                    log?.info(`[${CHANNEL_KEY}:${account.accountId}] Gateway ready, WS connected`);
                    const now = Date.now();
                    ctx.setStatus({
                        ...ctx.getStatus(),
                        running: true,
                        connected: true,
                        lastConnectedAt: now,
                        // 连接建立时即设置 lastEventAt，作为 health-monitor stale-socket 检测的初始基准
                        lastEventAt: now,
                    });
                },
                onDisconnect: () => {
                    ctx.setStatus({
                        ...ctx.getStatus(),
                        connected: false,
                    });
                },
                onError: (error) => {
                    log?.error(`[${CHANNEL_KEY}:${account.accountId}] Gateway error: ${error.message}`);
                    ctx.setStatus({
                        ...ctx.getStatus(),
                        lastError: error.message,
                    });
                },
                onEvent: () => {
                    // 通知框架收到了入站事件，防止 health-monitor 因 lastEventAt 过期而误判 stale-socket
                    ctx.setStatus({
                        ...ctx.getStatus(),
                        lastEventAt: Date.now(),
                        lastInboundAt: Date.now(),
                    });
                },
            });
        },
        /** 登出账户：清除凭证 */
        logoutAccount: async ({ accountId, cfg }) => {
            const nextCfg = { ...cfg };
            const section = nextCfg.channels?.[CHANNEL_KEY];
            let cleared = false;
            if (section) {
                if (accountId === DEFAULT_ACCOUNT_ID && section.apiKeys) {
                    delete section.apiKeys;
                    cleared = true;
                }
                const accounts = section.accounts;
                if (accounts?.[accountId]?.apiKeys) {
                    delete accounts[accountId].apiKeys;
                    cleared = true;
                }
            }
            return { ok: true, cleared };
        },
    },
    // ---- 状态面板 ----
    status: {
        defaultRuntime: {
            accountId: DEFAULT_ACCOUNT_ID,
            running: false,
            connected: false,
            lastConnectedAt: null,
            lastError: null,
        },
        buildChannelSummary: ({ snapshot }) => ({
            configured: snapshot.configured ?? false,
            running: snapshot.running ?? false,
            connected: snapshot.connected ?? false,
            lastConnectedAt: snapshot.lastConnectedAt ?? null,
            lastError: snapshot.lastError ?? null,
        }),
        buildAccountSnapshot: ({ account, runtime, }) => ({
            accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
            name: account?.name,
            enabled: account?.enabled ?? false,
            configured: Boolean(account?.allApiKeys?.length),
            tokenSource: account?.secretSource,
            running: runtime?.running ?? false,
            connected: runtime?.connected ?? false,
            lastConnectedAt: runtime?.lastConnectedAt ?? null,
            lastError: runtime?.lastError ?? null,
        }),
    },
};
//# sourceMappingURL=channel.js.map