import { CHANNEL_KEY } from "./config.js";
let runtime;
export function setAssistantRuntime(rt) {
    runtime = rt;
}
export function getAssistantRuntime() {
    if (!runtime)
        throw new Error(`[${CHANNEL_KEY}] PluginRuntime not initialized — register() not called yet`);
    return runtime;
}
//# sourceMappingURL=runtime.js.map