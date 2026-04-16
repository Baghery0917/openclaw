export const textHandler = {
    msgType: 'TIMTextElem',
    extract(_ctx, elem, _resData) {
        return elem.msg_content?.text || undefined;
    },
    buildMsgBody(data) {
        const text = data.text;
        return [
            {
                msg_type: 'TIMTextElem',
                msg_content: { text },
            },
        ];
    },
};
