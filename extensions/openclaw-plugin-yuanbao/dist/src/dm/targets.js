export function parseTarget(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.startsWith('user:')) {
        let id = trimmed.slice(5).trim();
        if (!id)
            return null;
        const displayName = id.startsWith('@') ? id : undefined;
        if (id.startsWith('@')) {
            id = id.slice(1).trim();
        }
        if (!id)
            return null;
        return { kind: 'user', id, displayName };
    }
    if (trimmed.startsWith('group:')) {
        const id = trimmed.slice(6).trim();
        if (!id)
            return null;
        return { kind: 'group', id };
    }
    if (trimmed.startsWith('channel:')) {
        const id = trimmed.slice(8).trim();
        if (!id)
            return null;
        return { kind: 'channel', id };
    }
    if (trimmed.startsWith('@')) {
        const handle = trimmed.slice(1).trim();
        if (!handle)
            return null;
        return { kind: 'user', id: handle, displayName: trimmed };
    }
    if (looksLikeYuanbaoId(trimmed)) {
        return { kind: 'user', id: trimmed };
    }
    return null;
}
export function looksLikeYuanbaoId(raw) {
    const trimmed = raw.trim();
    return /^\d+$/.test(trimmed) || /^[A-Za-z0-9+/=]{32,}$/.test(trimmed);
}
