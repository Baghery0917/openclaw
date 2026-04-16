export const faceHandler = {
    msgType: 'TIMFaceElem',
    extract(_ctx, elem, _resData) {
        const rawData = elem.msg_content?.data;
        if (rawData) {
            try {
                const faceData = JSON.parse(rawData);
                const name = faceData.name?.trim();
                if (name) {
                    return `[EMOJI: ${name}]`;
                }
            }
            catch {
            }
        }
        return '[EMOJI]';
    },
    buildMsgBody(data) {
        const { index, ...contentdata } = data;
        return [
            {
                msg_type: 'TIMFaceElem',
                msg_content: {
                    index,
                    data: JSON.stringify(contentdata),
                },
            },
        ];
    },
};
