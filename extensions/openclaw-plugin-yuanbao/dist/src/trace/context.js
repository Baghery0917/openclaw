import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes } from 'node:crypto';
import { createLog } from '../logger.js';
const traceStorage = new AsyncLocalStorage();
const EMPTY_TRACE_ID = '0'.repeat(32);
function generateHex(bytes) {
    return randomBytes(bytes).toString('hex');
}
export function generateTraceId() {
    return generateHex(16);
}
function normalizeTraceIdForTraceparent(traceId) {
    const normalized = traceId.trim().toLowerCase()
        .replace(/[^0-9a-f]/g, '');
    if (normalized.length >= 32) {
        const candidate = normalized.slice(0, 32);
        if (candidate !== EMPTY_TRACE_ID) {
            return candidate;
        }
    }
    const hashed = createHash('sha256').update(traceId.trim())
        .digest('hex')
        .slice(0, 32);
    if (hashed !== EMPTY_TRACE_ID) {
        return hashed;
    }
    return generateTraceId();
}
function buildTraceparent(traceId) {
    return `00-${normalizeTraceIdForTraceparent(traceId)}-${generateHex(8)}-01`;
}
function normalizeSeqId(seqId) {
    if (seqId === undefined || seqId === null)
        return undefined;
    const normalized = String(seqId).trim();
    return normalized || undefined;
}
export function resolveTraceContext(params) {
    const incomingTraceId = params.traceId?.trim();
    const traceId = incomingTraceId || generateTraceId();
    const seqId = normalizeSeqId(params.seqId);
    const baseSeq = seqId ? parseInt(seqId, 10) : NaN;
    let seqCounter = 0;
    const nextMsgSeq = () => {
        if (Number.isNaN(baseSeq))
            return undefined;
        seqCounter++;
        return baseSeq + seqCounter;
    };
    const log = createLog('trace');
    log.debug(`[msg-trace] resolve context: traceId=${traceId}${incomingTraceId ? '' : ' (generated)'}, seqId=${seqId ?? '(none)'}`);
    return {
        traceId,
        traceparent: buildTraceparent(traceId),
        nextMsgSeq,
        ...(seqId ? { seqId } : {}),
    };
}
export function getActiveTraceContext() {
    return traceStorage.getStore();
}
export function runWithTraceContext(traceContext, callback) {
    return traceStorage.run(traceContext, callback);
}
