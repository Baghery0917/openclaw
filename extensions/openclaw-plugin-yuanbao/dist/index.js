import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { setYuanbaoRuntime } from './src/runtime.js';
import { yuanbaoPlugin } from './src/channel.js';
import { initLogger } from './src/logger.js';
import { registerTools } from './src/tools/index.js';
import { yuanbaoUpgradeCommand, yuanbaobotUpgradeCommand } from './src/commands/upgrade/index.js';
import { logUploadCommandDefinition } from './src/commands/log-upload.js';
import { initEnv } from './src/utils/get-env.js';
import { initBuiltinStickers } from './src/sticker/init-builtin-stickers.js';
import pluginManifest from './openclaw.plugin.json' with { type: 'json' };
function patchCommandQueueState() {
    const key = Symbol.for('openclaw.commandQueueState');
    const state = globalThis[key];
    if (state && !state.activeTaskWaiters) {
        state.activeTaskWaiters = new Set();
    }
}
const plugin = {
    id: pluginManifest.id,
    name: pluginManifest.name,
    description: pluginManifest.description,
    configSchema: emptyPluginConfigSchema(),
    register(api) {
        patchCommandQueueState();
        initEnv(api);
        initLogger(api);
        setYuanbaoRuntime(api.runtime);
        api.registerChannel({ plugin: yuanbaoPlugin });
        registerTools(api);
        api.registerCommand(yuanbaoUpgradeCommand);
        api.registerCommand(yuanbaobotUpgradeCommand);
        api.registerCommand(logUploadCommandDefinition);
        initBuiltinStickers();
    },
};
export default plugin;
