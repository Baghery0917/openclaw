import { textHandler } from './text.js';
import { customHandler } from './custom.js';
import { imageHandler } from './image.js';
import { soundHandler } from './sound.js';
import { fileHandler } from './file.js';
import { videoHandler } from './video.js';
import { faceHandler } from './face.js';
const handlerList = [
    textHandler,
    customHandler,
    imageHandler,
    soundHandler,
    fileHandler,
    videoHandler,
    faceHandler,
];
const handlerMap = new Map(handlerList.map(h => [h.msgType, h]));
const outboundTypeToMsgType = {
    text: 'TIMTextElem',
    image: 'TIMImageElem',
    file: 'TIMFileElem',
    video: 'TIMVideoFileElem',
    custom: 'TIMCustomElem',
};
export function getHandler(msgType) {
    return handlerMap.get(msgType);
}
export function getAllHandlers() {
    return handlerList;
}
export function buildMsgBody(msgType, data) {
    const handler = handlerMap.get(msgType);
    return handler?.buildMsgBody?.(data);
}
const AT_USER_RE = /(?<=\s|^)@(\S+?)(?=\s|$)/g;
function resolveAtMentions(text, groupCode, memberInst) {
    const items = [];
    let lastIndex = 0;
    for (const match of text.matchAll(AT_USER_RE)) {
        const matchStart = match.index;
        if (matchStart > lastIndex) {
            const before = text.slice(lastIndex, matchStart);
            if (before.trim()) {
                items.push({ type: 'text', text: before.trim() });
            }
        }
        const nickName = match[1];
        const userRecord = groupCode && memberInst ? memberInst.lookupUserByNickName(groupCode, nickName) : undefined;
        if (userRecord) {
            items.push({
                type: 'custom',
                data: JSON.stringify({
                    elem_type: 1002,
                    text: `@${userRecord.nickName}`,
                    user_id: userRecord.userId,
                }),
            });
        }
        else {
            items.push({ type: 'text', text: `@${nickName}` });
        }
        lastIndex = matchStart + match[0].length;
    }
    if (lastIndex < text.length) {
        const trailing = text.slice(lastIndex);
        if (trailing.trim()) {
            items.push({ type: 'text', text: trailing.trim() });
        }
    }
    if (items.length === 0 && text.trim()) {
        items.push({ type: 'text', text: text.trim() });
    }
    return items;
}
export function prepareOutboundContent(text, groupCode, memberInst) {
    if (!text)
        return [];
    const items = [];
    if (text.length) {
        const trailing = text.trim();
        if (trailing) {
            items.push(...resolveAtMentions(trailing, groupCode, memberInst));
        }
    }
    if (items.length === 0 && text.trim()) {
        items.push(...resolveAtMentions(text.trim(), groupCode, memberInst));
    }
    return items;
}
export function buildOutboundMsgBody(items) {
    const msgBody = [];
    for (const item of items) {
        const msgType = outboundTypeToMsgType[item.type];
        if (!msgType)
            continue;
        const handler = handlerMap.get(msgType);
        if (!handler?.buildMsgBody)
            continue;
        const { type: _type, ...data } = item;
        const elems = handler.buildMsgBody(data);
        if (elems) {
            msgBody.push(...elems);
        }
    }
    return msgBody;
}
export { textHandler } from './text.js';
export { customHandler, buildAtUserMsgBodyItem } from './custom.js';
export { imageHandler } from './image.js';
export { soundHandler } from './sound.js';
export { fileHandler } from './file.js';
export { videoHandler } from './video.js';
export { faceHandler } from './face.js';
