import { createLog } from '../../logger.js';
import { fetchLatestStableVersion, isPublishedVersionOnNpm, isValidVersion, PLUGIN_ID, readInstalledVersion, runOpenClawCommand, runOpenClawCommandWithRetry, snapshotYuanbaoChannelConfig, } from './utils.js';
const log = createLog('upgrade');
const INSTALL_SCRIPT_TIMEOUT_MS = 5 * 60 * 1000;
var MessageEnum;
(function (MessageEnum) {
    MessageEnum["REPAIR_BOT_CONFIG_GUIDE"] = "\u274C \u5347\u7EA7\u5931\u8D25\uFF0C\u8BF7\u524D\u5F80 Bot \u7BA1\u7406\u9875\u9762\u4F7F\u7528\u300C\u4FEE\u590D Bot \u914D\u7F6E\u300D\u529F\u80FD\u4FEE\u590D\u3002";
    MessageEnum["AUTO_UPGRADE_FAILED_FALLBACK"] = "\u274C \u5347\u7EA7\u547D\u4EE4\u6267\u884C\u5931\u8D25\uFF0C\u5143\u5B9D\u521B\u5EFA\u7684 Bot \u53EF\u524D\u5F80\u300CBot \u8BBE\u7F6E\u300D\u70B9\u51FB\u300C\u66F4\u65B0\u63D2\u4EF6\u300D\u8FDB\u884C\u5347\u7EA7\u3002";
})(MessageEnum || (MessageEnum = {}));
async function runSpecifiedVersionFlow(params) {
    const { targetVersion: _targetVersion, currentVersion, config, onProgress, } = params;
    const hasTargetVersion = !!_targetVersion;
    const targetVersion = _targetVersion ?? await fetchLatestStableVersion();
    log.info('检测到指定版本请求，执行卸载重装流程', {
        currentVersion: currentVersion ?? '(读取失败)',
        targetVersion,
    });
    if (currentVersion && currentVersion === targetVersion) {
        log.info('已是最新版本，跳过升级', { version: targetVersion });
        return { ok: true, skip: true, message: `✅ 当前已是最新版本（v${targetVersion}），无需更新。` };
    }
    if (hasTargetVersion) {
        await onProgress?.(currentVersion
            ? `🔄 正在将**元宝 Bot 插件**从 **v${currentVersion}** 升级至 **v${targetVersion}** ，请稍等片刻。`
            : `⏳ 正在将**元宝 Bot 插件**升级至 **v${targetVersion}** ，请稍等片刻。`);
    }
    const restoreSnapshotJson = snapshotYuanbaoChannelConfig(config);
    log.info('指定版本安装前已记录 yuanbao channel 配置', { hasSnapshot: !!restoreSnapshotJson });
    const restoreSnapshotConfig = async () => {
        if (!restoreSnapshotJson)
            return { ok: true };
        const restoreResult = await runOpenClawCommand([
            'config',
            'set',
            'channels.yuanbao',
            restoreSnapshotJson,
            '--strict-json',
        ]);
        if (!restoreResult.ok) {
            return { ok: false, error: restoreResult.error };
        }
        return { ok: true };
    };
    const clearResult = await runOpenClawCommand(['config', 'unset', 'channels.yuanbao']);
    if (!clearResult.ok) {
        log.error('指定版本安装失败：清理 channels.yuanbao 配置失败');
    }
    else {
        log.info('指定版本安装前已清理 channels.yuanbao 配置');
    }
    const uninstallResult = await runOpenClawCommand(['plugins', 'uninstall', '--force', PLUGIN_ID]);
    if (!uninstallResult.ok) {
        const restoreAfterUninstallFailure = await restoreSnapshotConfig();
        if (!restoreAfterUninstallFailure.ok) {
            log.error('指定版本安装失败：卸载失败后配置恢复失败', { error: restoreAfterUninstallFailure.error });
            return {
                ok: false,
                error: `配置恢复失败：${restoreAfterUninstallFailure.error ?? 'unknown error'}`,
                message: MessageEnum.REPAIR_BOT_CONFIG_GUIDE,
            };
        }
        const details = `${uninstallResult.error ?? ''}\n${uninstallResult.stderr ?? ''}`;
        if (!/plugin not found/i.test(details)) {
            log.error('指定版本安装失败：卸载步骤失败', { error: uninstallResult.error });
            return {
                ok: false,
                error: uninstallResult.error ?? '插件卸载失败',
                message: MessageEnum.REPAIR_BOT_CONFIG_GUIDE,
            };
        }
        log.warn('卸载步骤返回未安装，继续安装', { error: uninstallResult.error });
    }
    const installResult = await runOpenClawCommandWithRetry({
        args: ['plugins', 'install', `${PLUGIN_ID}@${targetVersion}`],
        timeoutMs: INSTALL_SCRIPT_TIMEOUT_MS,
        commandName: 'plugins install',
    });
    const restoreAfterInstall = await restoreSnapshotConfig();
    if (!restoreAfterInstall.ok) {
        log.error('指定版本安装失败：配置恢复失败', { error: restoreAfterInstall.error });
        return {
            ok: false,
            error: `配置恢复失败：${restoreAfterInstall.error ?? 'unknown error'}`,
            message: MessageEnum.REPAIR_BOT_CONFIG_GUIDE,
        };
    }
    if (!installResult.ok) {
        log.error('指定版本安装失败：安装步骤失败', { targetVersion, error: installResult.error });
        return {
            ok: false,
            error: installResult.error ?? '插件安装失败',
            message: MessageEnum.REPAIR_BOT_CONFIG_GUIDE,
        };
    }
    log.info('指定版本安装流程完成', { targetVersion, hasSnapshot: !!restoreSnapshotJson });
    await onProgress?.(currentVersion
        ? `✅ 更新成功！**元宝 Bot 插件**已从 v${currentVersion} 升级至 v${targetVersion}`
        : `✅ 更新成功！**元宝 Bot 插件**已升级至 v${targetVersion}`);
    return { ok: true };
}
async function runRegularUpgradeFlow(params) {
    const { currentVersion, onProgress } = params;
    const latestStableVersion = await fetchLatestStableVersion();
    if (latestStableVersion && currentVersion && currentVersion === latestStableVersion) {
        log.info('已是最新正式版本，跳过升级', { version: latestStableVersion });
        return { ok: true, skip: true, message: `✅ 当前已是最新版本（v${latestStableVersion}），无需更新。` };
    }
    if (!latestStableVersion) {
        log.warn('未获取到 npm 最新正式版本，将直接执行 update');
    }
    await onProgress?.(currentVersion && latestStableVersion
        ? `🔄 正在将**元宝 Bot 插件**从 **v${currentVersion}** 升级至 **v${latestStableVersion}** ，请稍等片刻。`
        : '⏳ 正在将**元宝 Bot 插件**升级至最新版本，请稍等片刻。');
    const updateResult = await runOpenClawCommandWithRetry({
        args: ['plugins', 'update', `${PLUGIN_ID}@latest`],
        commandName: 'plugins update',
    });
    if (!updateResult.ok) {
        log.warn('更新命令执行失败', { error: updateResult.error, ...(updateResult.stderr ? { stderr: updateResult.stderr } : {}) });
        return { ok: false, error: updateResult.error ?? '常规升级失败' };
    }
    if (updateResult.stdout?.includes('No install record')) {
        return { ok: false, error: updateResult.error ?? '常规升级失败，需要重新安装', needToInstall: true };
    }
    log.info('更新命令执行完毕');
    await onProgress?.(latestStableVersion
        ? `✅ 更新成功！**元宝 Bot 插件**已从 v${currentVersion} 升级至 v${latestStableVersion}`
        : '✅ 更新成功！**元宝 Bot 插件**已更新至最新版本');
    return { ok: true };
}
export async function performUpgrade(config, accountId, onProgress, targetVersion) {
    log.info('开始升级流程', { targetVersion: targetVersion ?? '(最新正式版)' });
    void accountId;
    const isTargetVersionSpecified = !!targetVersion;
    if (isTargetVersionSpecified) {
        const requestedVersion = targetVersion;
        if (!isValidVersion(requestedVersion)) {
            log.error('指定的版本号格式无效，升级流程中止', { targetVersion });
            return `❌ 版本号格式无效：\`${targetVersion}\`，请使用 \`1.2.3\` 或 \`1.2.3-beta.abc\` 格式。`;
        }
        const isPublished = await isPublishedVersionOnNpm(requestedVersion);
        if (!isPublished) {
            log.error('指定版本在 npm 不存在，升级流程中止', { targetVersion });
            return `❌ 指定版本 \`${targetVersion}\` 不存在或暂不可用，请确认版本号后重试。`;
        }
    }
    const currentVersion = await readInstalledVersion(PLUGIN_ID);
    log.info('读取当前版本', { currentVersion: currentVersion ?? '(读取失败)', targetVersion: targetVersion ?? '(未指定)' });
    const disableReloadResult = await runOpenClawCommand(['config', 'set', 'gateway.reload.mode', 'off']);
    if (!disableReloadResult.ok) {
        log.error('升级流程中止：关闭自动重载失败', { error: disableReloadResult.error });
        return MessageEnum.AUTO_UPGRADE_FAILED_FALLBACK;
    }
    try {
        if (isTargetVersionSpecified) {
            const result = await runSpecifiedVersionFlow({ targetVersion, currentVersion, config, onProgress });
            if (!result.ok)
                return result.message ?? MessageEnum.AUTO_UPGRADE_FAILED_FALLBACK;
            if (result.skip)
                return result.message ?? '✅ 当前已是指定版本，无需更新。';
        }
        else {
            const result = await runRegularUpgradeFlow({ currentVersion, onProgress });
            if (!result.ok) {
                if (result.needToInstall) {
                    log.info('常规升级失败，需要通过指定版本安装流程重新安装');
                    const result = await runSpecifiedVersionFlow({ currentVersion, config, onProgress });
                    if (!result.ok)
                        return result.message ?? MessageEnum.AUTO_UPGRADE_FAILED_FALLBACK;
                    if (result.skip)
                        return result.message ?? '✅ 当前已是指定版本，无需更新。';
                }
                else {
                    return result.message ?? MessageEnum.AUTO_UPGRADE_FAILED_FALLBACK;
                }
            }
            if (result.skip)
                return result.message ?? '✅ 当前已是最新版本，无需更新。';
        }
    }
    finally {
        const restoreReloadResult = await runOpenClawCommand(['config', 'set', 'gateway.reload.mode', 'hybrid']);
        if (!restoreReloadResult.ok) {
            log.error('恢复 gateway.reload.mode=hybrid 失败', { error: restoreReloadResult.error ?? '恢复自动重载失败' });
        }
    }
    await onProgress?.('⏳ OpenClaw Gateway 准备重启，预计需要花费 10 秒左右，重启后升级生效。');
    const restartResult = await runOpenClawCommand(['gateway', 'restart']);
    log.info('升级后重启命令执行结果', { ok: restartResult.ok, error: restartResult.error });
    return '';
}
