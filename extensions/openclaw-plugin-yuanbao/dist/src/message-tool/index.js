import { getActiveWsClient } from '../yuanbao-server/ws/index.js';
import { handleYuanbaoAction } from './action-runtime.js';
import { resolveYuanbaoAccount } from '../accounts.js';
import { handleAction as handleSendAction } from '../dm/handle-action.js';
export { buildMessageToolHints } from './hints.js';
const SUPPORTED_ACTIONS = [
    'sticker-search',
    'sticker',
    'react',
];
function describeMessageTool() {
    return {
        actions: SUPPORTED_ACTIONS,
    };
}
function listActions() {
    return SUPPORTED_ACTIONS;
}
async function handleAction(params) {
    const { action, params: actionParams, accountId, cfg } = params;
    if (action === 'send') {
        return await handleSendAction(params);
    }
    const account = resolveYuanbaoAccount({ cfg, accountId });
    const wsClient = getActiveWsClient(accountId);
    if (!wsClient) {
        return {
            ok: false,
            error: `WebSocket client not connected for account ${accountId}`,
        };
    }
    return handleYuanbaoAction(action, actionParams, {
        wsClient,
        toAccount: actionParams.to || actionParams.target,
        account,
        config: cfg,
    });
}
export const yuanbaoMessageActions = {
    describeMessageTool,
    handleAction,
    listActions,
    extractToolSend: () => undefined,
    supportsAction: ({ action }) => SUPPORTED_ACTIONS.includes(action),
};
