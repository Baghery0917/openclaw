var ImClientMessageTypeEnum;
(function (ImClientMessageTypeEnum) {
    ImClientMessageTypeEnum[ImClientMessageTypeEnum["MT_UNKNOW"] = 0] = "MT_UNKNOW";
    ImClientMessageTypeEnum[ImClientMessageTypeEnum["MT_TEXT"] = 1] = "MT_TEXT";
    ImClientMessageTypeEnum[ImClientMessageTypeEnum["MT_PIC"] = 2] = "MT_PIC";
    ImClientMessageTypeEnum[ImClientMessageTypeEnum["MT_FILE"] = 3] = "MT_FILE";
    ImClientMessageTypeEnum[ImClientMessageTypeEnum["MT_VIDEO"] = 4] = "MT_VIDEO";
    ImClientMessageTypeEnum[ImClientMessageTypeEnum["MT_AUDIO"] = 5] = "MT_AUDIO";
})(ImClientMessageTypeEnum || (ImClientMessageTypeEnum = {}));
export function parseQuoteFromCloudCustomData(cloudCustomData) {
    if (!cloudCustomData)
        return undefined;
    try {
        const parsed = JSON.parse(cloudCustomData);
        if (!parsed.quote || typeof parsed.quote !== 'object')
            return undefined;
        const { quote } = parsed;
        if (Number(quote.type) === ImClientMessageTypeEnum.MT_PIC) {
            quote.desc = quote.desc?.trim() || '[image]';
        }
        if (!quote.desc?.trim())
            return undefined;
        return quote;
    }
    catch {
        return undefined;
    }
}
const QUOTE_DESC_MAX_LENGTH = 500;
export function formatQuoteContext(quote) {
    let senderPart = '';
    if (quote.id) {
        senderPart = ` id "${quote.id}"`;
    }
    else if (quote.sender_nickname) {
        senderPart = ` from ${quote.sender_nickname}`;
    }
    let desc = quote.desc?.trim() || '';
    if (desc.length > QUOTE_DESC_MAX_LENGTH) {
        desc = `${desc.slice(0, QUOTE_DESC_MAX_LENGTH)}...(truncated)`;
    }
    return `> [Quoted message${senderPart}]:\n>${desc}\n`;
}
