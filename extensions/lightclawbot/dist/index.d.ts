import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
declare const plugin: {
    id: string;
    name: string;
    description: string;
    configSchema: import("openclaw/plugin-sdk/core").OpenClawPluginConfigSchema;
    register(api: OpenClawPluginApi): void;
};
export default plugin;
export { myAssistantPlugin } from "./src/channel.js";
export { setAssistantRuntime, getAssistantRuntime } from "./src/runtime.js";
export * from "./src/types.js";
export * from "./src/config.js";
export * from "./src/gateway.js";
export * from "./src/dedup.js";
export * from "./src/media.js";
export * from "./src/inbound.js";
export * from "./src/socket/index.js";
export * from "./src/outbound.js";
export * from "./src/history/index.js";
export * from "./src/file-storage.js";
export * from "./src/upload-tool.js";
export * from "./src/download-tool.js";
//# sourceMappingURL=index.d.ts.map