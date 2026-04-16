import { createLog } from '../logger.js';
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
function isRateLimited(senderId, maxPerHour) {
    if (maxPerHour <= 0)
        return true;
    const now = Date.now();
    const timestamps = rateLimitMap.get(senderId) ?? [];
    const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    rateLimitMap.set(senderId, recent);
    return recent.length >= maxPerHour;
}
export function recordDMSend(senderId) {
    const timestamps = rateLimitMap.get(senderId) ?? [];
    timestamps.push(Date.now());
    rateLimitMap.set(senderId, timestamps);
}
export const DEFAULT_DM_ACCESS_POLICY = {
    allowedSenders: 'all',
    senderAllowlist: [],
    rateLimitPerHour: 60,
    maxMessageLength: 4000,
};
export function enforceDMAccess(senderId, targetId, messageLength, policy = DEFAULT_DM_ACCESS_POLICY) {
    const log = createLog('dm:access');
    if (senderId === targetId) {
        return { allowed: false, reason: 'Cannot send a DM to yourself via bot' };
    }
    if (policy.allowedSenders === 'allowlist') {
        if (!policy.senderAllowlist?.includes(senderId)) {
            return { allowed: false, reason: 'You are not authorized to send DMs via bot' };
        }
    }
    if (messageLength > policy.maxMessageLength) {
        return {
            allowed: false,
            reason: `Message too long (${messageLength} chars). Maximum: ${policy.maxMessageLength}`,
        };
    }
    if (isRateLimited(senderId, policy.rateLimitPerHour)) {
        log.error('频率限制触发 ', { senderId, rateLimitPerHour: policy.rateLimitPerHour });
        return { allowed: false, reason: 'Rate limit exceeded. Please try again later.' };
    }
    return { allowed: true };
}
