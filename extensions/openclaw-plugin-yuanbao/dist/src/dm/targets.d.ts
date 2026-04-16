export interface DMTarget {
    kind: 'user';
    id: string;
    displayName?: string;
}
export interface ChannelTarget {
    kind: 'channel' | 'group';
    id: string;
}
export type MessagingTarget = DMTarget | ChannelTarget;
export declare function parseTarget(raw: string): MessagingTarget | null;
export declare function looksLikeYuanbaoId(raw: string): boolean;
