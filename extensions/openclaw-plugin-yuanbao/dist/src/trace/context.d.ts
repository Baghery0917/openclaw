export type YuanbaoTraceContext = {
    traceId: string;
    traceparent: string;
    seqId?: string;
    nextMsgSeq: () => number | undefined;
};
export declare function generateTraceId(): string;
export declare function resolveTraceContext(params: {
    traceId?: string;
    seqId?: string | number;
}): YuanbaoTraceContext;
export declare function getActiveTraceContext(): YuanbaoTraceContext | undefined;
export declare function runWithTraceContext<T>(traceContext: YuanbaoTraceContext, callback: () => Promise<T>): Promise<T>;
