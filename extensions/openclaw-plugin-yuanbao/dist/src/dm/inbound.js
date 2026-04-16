export function extractTargetMentions(msgBody, botIdentifiers) {
    if (!msgBody || !Array.isArray(msgBody))
        return [];
    const mentionedUsers = [];
    for (const elem of msgBody) {
        if (elem.msg_type !== 'TIMCustomElem')
            continue;
        const rawData = elem.msg_content?.data;
        if (!rawData || typeof rawData !== 'string')
            continue;
        try {
            const customContent = JSON.parse(rawData);
            if (customContent?.elem_type !== 1002)
                continue;
            const userId = customContent.user_id;
            const { text } = customContent;
            if (userId && botIdentifiers.botId && userId === botIdentifiers.botId)
                continue;
            if (userId || text) {
                mentionedUsers.push({
                    raw: text ?? `@${userId}`,
                    platformId: userId,
                    displayName: text?.replace(/^@/, '') ?? userId,
                });
            }
        }
        catch {
        }
    }
    return mentionedUsers;
}
export function extractTargetMentionsFromText(messageText, botIdentifiers) {
    const mentionedUsers = [];
    const mentionRegex = /@(\S+)/g;
    let match;
    while ((match = mentionRegex.exec(messageText)) !== null) {
        const handle = match[1];
        if (botIdentifiers.botUsername && handle.toLowerCase() === botIdentifiers.botUsername.toLowerCase()) {
            continue;
        }
        if (botIdentifiers.botId && handle === botIdentifiers.botId) {
            continue;
        }
        mentionedUsers.push({
            raw: match[0],
            displayName: handle,
        });
    }
    return mentionedUsers;
}
export function detectImplicitMention(replyToAuthorId, botId, isDirectMessage) {
    if (isDirectMessage)
        return false;
    if (!replyToAuthorId || !botId)
        return false;
    return replyToAuthorId === botId;
}
