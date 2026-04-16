export declare function setGroupCode(code: string): void;
export declare function getGroupCode(): string | undefined;
export declare function looksLikeYuanbaoId(raw: string): boolean;
export declare enum ChatType {
    C2C = "c2c",
    GROUP = "group"
}
export interface MessagingTarget {
    chatType: ChatType;
    target: string;
    sessionKey: string;
}
export declare function parseTarget(to: string, accountId?: string): MessagingTarget;
