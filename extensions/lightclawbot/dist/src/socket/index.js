/**
 * LightClaw — Socket 模块统一入口
 *
 * 收敛所有 socket 相关逻辑：事件处理器、注册表、可靠发送。
 */
export { bindSocketHandlers } from "./handlers.js";
export { registerSocket, unregisterSocket, getSocket, hasEntry, getBotClientId, getReliableEmitter, bufferMessage, flushPendingMessages, getPendingCount, } from "./registry.js";
export { ReliableEmitter } from "./reliable-emitter.js";
//# sourceMappingURL=index.js.map