/**
 * LightClaw — 出站消息适配器
 *
 * 处理 OpenClaw 框架层的主动消息发送（非 deliver 回调场景）。
 * 例如：用户通过 /message 命令发消息、cron 定时任务触发等。
 *
 * 发送策略：
 *   1. 优先通过 gateway 的 WS 长连接发送（socket-registry）
 *   2. WS 不可用时 fallback 到 REST API（需配置 apiBaseUrl）
 */
import type { ChannelOutboundContext } from "openclaw/plugin-sdk/channel-runtime";
/**
 * 发送文本消息
 * 由 channel.outbound.sendText 调用
 */
export declare function sendText(ctx: ChannelOutboundContext): Promise<{
    channel: string;
    messageId: string;
}>;
/**
 * 发送媒体消息
 * 由 channel.outbound.sendMedia 调用
 */
export declare function sendMedia(ctx: ChannelOutboundContext): Promise<{
    channel: string;
    messageId: string;
}>;
//# sourceMappingURL=outbound.d.ts.map