import { resolveUsername } from './dm/directory.js';
import { logger } from './logger.js';
let groupCode = '';
export function setGroupCode(code) {
    groupCode = code;
}
export function getGroupCode() {
    if (!groupCode) {
        logger.warn('GroupCode not initialized');
        return undefined;
    }
    return groupCode;
}
export function looksLikeYuanbaoId(raw) {
    const trimmed = raw.trim();
    if (trimmed.length < 24) {
        return false;
    }
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?!.*=.+)[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
        return false;
    }
    return true;
}
export var ChatType;
(function (ChatType) {
    ChatType["C2C"] = "c2c";
    ChatType["GROUP"] = "group";
})(ChatType || (ChatType = {}));
export function parseTarget(to, accountId = 'default') {
    to = to.trim().replace(/^yuanbao:/, '');
    if (to.startsWith('group:')) {
        return { chatType: ChatType.GROUP, target: to.slice('group:'.length), sessionKey: to };
    }
    to = to.replace(/^user:/, '').replace(/^direct:/, '');
    if (!looksLikeYuanbaoId(to)) {
        const { userId } = resolveUsername(to, accountId, groupCode) || { userId: to };
        return { chatType: ChatType.C2C, target: userId, sessionKey: `direct:${userId}` };
    }
    return { chatType: ChatType.C2C, target: to, sessionKey: `direct:${to}` };
}
