import { getHandler } from './handlers/index.js';
export function extractTextFromMsgBody(ctx, msgBody) {
    const resData = { rawBody: '', isAtBot: false, medias: [], mentions: [] };
    if (!msgBody || !Array.isArray(msgBody))
        return resData;
    const texts = [];
    for (const elem of msgBody) {
        const handler = getHandler(elem.msg_type);
        if (handler) {
            const text = handler.extract(ctx, elem, resData);
            if (text)
                texts.push(text);
        }
    }
    resData.rawBody = texts.join('\n');
    return resData;
}
