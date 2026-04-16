/**
 * LightClaw — ChannelPlugin 主定义
 *
 * 这是 OpenClaw 框架的「注册契约」：
 * 声明插件 ID、能力、配置管理、出站适配、Gateway 生命周期等。
 * 框架通过这个对象了解你的插件能做什么、怎么启动、怎么发消息。
 */
import { type ChannelPlugin } from "openclaw/plugin-sdk/core";
import type { ResolvedAssistantAccount } from "./types.js";
export declare const myAssistantPlugin: ChannelPlugin<ResolvedAssistantAccount>;
//# sourceMappingURL=channel.d.ts.map