import { createLog } from '../logger.js';
import { performLogExport } from '../module/log-upload/index.js';
const log = createLog('log-upload');
export const logUploadCommandDefinition = {
    name: 'issue-log',
    description: '提取 OpenClaw 日志并打包为本地临时文件（jsonl.gz）',
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
        try {
            const text = await performLogExport(ctx);
            return { text };
        }
        catch (err) {
            log.error('日志导出失败', { error: String(err) });
            return {
                isError: true,
                text: `❌ 日志导出失败：${String(err)}`,
            };
        }
    },
};
