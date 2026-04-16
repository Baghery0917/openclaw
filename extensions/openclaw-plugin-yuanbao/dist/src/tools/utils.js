export function isYbGroupChat(ctx) {
    if (ctx.messageChannel === 'yuanbao') {
        return ctx.sessionKey?.includes('yuanbao:group:') ?? false;
    }
    return false;
}
export function extractGroupCode(sessionKey) {
    const prefix = 'yuanbao:group:';
    const idx = sessionKey.indexOf(prefix);
    if (idx === -1)
        return '';
    return sessionKey.slice(idx + prefix.length);
}
export function text(t) {
    return { content: [{ type: 'text', text: t }] };
}
export function json(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        details: data,
    };
}
