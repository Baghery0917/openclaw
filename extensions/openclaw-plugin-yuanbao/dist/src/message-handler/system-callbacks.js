import { handleC2CRecall, handleGroupRecall } from './callbacks/recall.js';
const systemCallbackRegistry = new Map();
export function registerSystemCallback(command, handler) {
    systemCallbackRegistry.set(command, handler);
}
export function dispatchSystemCallback(params) {
    const command = params.msg.callback_command;
    if (!command)
        return false;
    const handler = systemCallbackRegistry.get(command);
    if (!handler)
        return false;
    handler(params);
    return true;
}
registerSystemCallback('Group.CallbackAfterRecallMsg', ({ ctx, msg }) => handleGroupRecall(ctx, msg));
registerSystemCallback('C2C.CallbackAfterMsgWithDraw', ({ ctx, msg }) => handleC2CRecall(ctx, msg));
