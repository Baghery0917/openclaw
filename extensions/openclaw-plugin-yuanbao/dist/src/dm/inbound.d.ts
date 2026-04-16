import type { YuanbaoMsgBodyElement } from '../types.js';
export interface MentionedUser {
    raw: string;
    platformId?: string;
    displayName?: string;
}
export interface BotIdentifiers {
    botId?: string;
    botUsername?: string;
}
export declare function extractTargetMentions(msgBody: YuanbaoMsgBodyElement[] | undefined, botIdentifiers: BotIdentifiers): MentionedUser[];
export declare function extractTargetMentionsFromText(messageText: string, botIdentifiers: BotIdentifiers): MentionedUser[];
export declare function detectImplicitMention(replyToAuthorId: string | undefined, botId: string | undefined, isDirectMessage: boolean): boolean;
