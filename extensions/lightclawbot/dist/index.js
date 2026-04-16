import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import { myAssistantPlugin } from "./src/channel.js";
import { setAssistantRuntime } from "./src/runtime.js";
import { registerUploadTool } from "./src/upload-tool.js";
// import { registerDownloadTool } from "./src/download-tool.js";
const plugin = {
    id: "lightclawbot",
    name: "LightClawBot",
    description: "Channel plugin for LightClawBot",
    configSchema: emptyPluginConfigSchema(),
    register(api) {
        setAssistantRuntime(api.runtime);
        api.registerChannel({ plugin: myAssistantPlugin });
        // 注册文件存储工具（飞书工厂函数模式：execute 时动态从 api.config 解析 apiKey）
        registerUploadTool(api);
        // registerDownloadTool(api);
    },
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
//# sourceMappingURL=index.js.map