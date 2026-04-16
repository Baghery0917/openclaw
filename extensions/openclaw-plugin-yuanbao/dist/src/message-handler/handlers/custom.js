import { createLog } from '../../logger.js';
export function buildAtUserMsgBodyItem(userId, senderNickname) {
    return {
        msg_type: 'TIMCustomElem',
        msg_content: {
            data: JSON.stringify({ elem_type: 1002, text: `@${senderNickname ?? ''}`, user_id: userId }),
        },
    };
}
const FALLBACK_TEXT = '[custom]';
export const customHandler = {
    msgType: 'TIMCustomElem',
    extract(ctx, elem, resData) {
        if (elem.msg_content?.data) {
            try {
                const customContent = JSON.parse(elem.msg_content?.data);
                if (customContent?.elem_type !== 1002) {
                    return FALLBACK_TEXT;
                }
                const { botId } = ctx.account;
                const isAtBotSelf = customContent?.user_id === botId;
                if (!resData.isAtBot) {
                    resData.isAtBot = isAtBotSelf;
                }
                createLog('custom', ctx.log).info('@消息', { text: customContent?.text, userId: customContent?.user_id, isAtBot: resData.isAtBot });
                if (!isAtBotSelf && customContent?.user_id) {
                    resData.mentions.push({
                        userId: customContent.user_id,
                        text: customContent.text || '',
                    });
                }
                const result = !isAtBotSelf && customContent.text ? customContent.text : undefined;
                return result;
            }
            catch { }
        }
        return FALLBACK_TEXT;
    },
    buildMsgBody(data) {
        const customData = typeof data.data === 'string'
            ? data.data
            : JSON.stringify(data.data);
        return [
            {
                msg_type: 'TIMCustomElem',
                msg_content: { data: customData },
            },
        ];
    },
};
