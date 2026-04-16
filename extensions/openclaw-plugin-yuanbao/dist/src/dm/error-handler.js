const MESSAGE_PATTERNS = [
    {
        keywords: ['wsclient', 'websocket', 'not connected'],
        toError: detail => ({ kind: 'ws-unavailable', detail }),
    },
    {
        keywords: ['rate', 'frequency', 'too many'],
        toError: () => ({ kind: 'rate-limited' }),
    },
    {
        keywords: ['block', 'forbidden'],
        toError: detail => ({ kind: 'dm-blocked', detail }),
    },
    {
        keywords: ['not found', 'invalid', 'no such user'],
        toError: detail => ({ kind: 'user-not-found', detail }),
    },
];
const IM_ERROR_CODE_MAP = {
    20003: code => ({ kind: 'user-not-found', detail: `IM error code: ${code}` }),
    20009: code => ({ kind: 'user-not-found', detail: `IM error code: ${code}` }),
    20006: code => ({ kind: 'dm-blocked', detail: `IM error code: ${code}` }),
};
function classifyByMessage(message) {
    const msg = message.toLowerCase();
    for (const pattern of MESSAGE_PATTERNS) {
        if (pattern.keywords.some(kw => msg.includes(kw))) {
            return pattern.toError(message);
        }
    }
    return null;
}
function classifyByErrorCode(err) {
    if (typeof err !== 'object' || err === null)
        return null;
    const errObj = err;
    const code = errObj.code ?? errObj.error_code ?? errObj.errorCode;
    if (typeof code !== 'number')
        return null;
    const factory = IM_ERROR_CODE_MAP[code];
    return factory ? factory(code) : null;
}
export function classifyError(err) {
    if (err instanceof Error) {
        const matched = classifyByMessage(err.message);
        if (matched)
            return matched;
    }
    const codeMatch = classifyByErrorCode(err);
    if (codeMatch) {
        return codeMatch;
    }
    return { kind: 'unknown', detail: String(err) };
}
export function formatDMErrorForUser(error, targetDisplay) {
    switch (error.kind) {
        case 'user-not-found':
            return `❌ 找不到用户 ${targetDisplay}，请确认用户名是否正确`;
        case 'dm-blocked':
            return `❌ 无法给 ${targetDisplay} 发送私信，对方可能关闭了私信功能`;
        case 'bot-not-started':
            return `❌ ${targetDisplay} 尚未与我建立对话，请先让对方向我发送一条消息`;
        case 'rate-limited':
            return `⏳ 发送过于频繁，请稍后再试${error.retryAfter ? `（${error.retryAfter}秒后重试）` : ''}`;
        case 'text-too-long':
            return `❌ 消息过长，请控制在 ${error.maxLength} 字符以内`;
        case 'invalid-target':
            return '❌ 无法识别目标，请使用 @用户名 或 user:用户ID 格式';
        case 'ws-unavailable':
            return '❌ 消息通道暂时不可用，请稍后再试';
        default:
            return `❌ 发送失败：${error.detail}`;
    }
}
