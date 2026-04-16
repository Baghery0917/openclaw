export function buildDMMessageToolHints() {
    return [
        '- If the recent thread shows the user sent pack stickers / TIM faces, match that tone: prefer `sticker-search` then `sticker` over text-only or bare Unicode emoji.',
        '- Proactive `send` to another user: `to="user:@username"` or `to="user:<userId>"`, text only. stickers and media are not supported',
        '- When asked to send a DM, extract the recipient and message from the user\'s request. If either is ambiguous, ask for clarification before calling the tool.',
        '- After sending a DM, report the result (success/failure) in the conversation where the user asked. Do not modify the intended message text.',
        '- To find a user\'s ID, use the lookup_conversation_members tool first, then pass the resolved ID to the message tool.',
    ];
}
