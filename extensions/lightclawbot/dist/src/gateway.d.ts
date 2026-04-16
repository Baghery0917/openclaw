/**
 * LightClaw — Socket.IO Gateway
 *
 * 连接编排层：
 * 1. 管理 Socket.IO 连接生命周期（连接/断开/重连/防重入）
 * 2. 维护消息队列，串行处理入站消息
 * 3. 提供 socket emit 抽象供子模块使用
 *
 * 消息处理逻辑 → inbound.ts
 * 事件监听绑定 → socket-handlers.ts
 * 去重/节流/ID → dedup.ts
 * 媒体文件处理 → media.ts
 */
import type { GatewayContext } from "./types.js";
export declare function startGateway(ctx: GatewayContext): Promise<void>;
//# sourceMappingURL=gateway.d.ts.map