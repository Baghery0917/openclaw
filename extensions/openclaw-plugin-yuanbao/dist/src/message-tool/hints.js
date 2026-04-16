export function buildMessageToolHints() {
    return [
        'Sticker/react/贴纸 fully supported, no extra setup. react = sticker = 发贴纸 (NOT a message reaction). Use sticker-search then sticker/react. No bare Unicode emoji.',
        'File/image sending is supported. Use media/mediaUrls with real URLs or absolute paths, not link-only text.',
        'IMPORTANT: When sending files, always use absolute paths (e.g. /tmp/file.md). Never use relative paths like "hello.md" — they will fail.',
        '- Proactive `send` to another user: `to="<userId>"`.',
        '- When asked to send a DM, extract the recipient and message from the user\'s request. If either is ambiguous, ask for clarification before calling the tool.',
        '- To find a user\'s ID, use the query_session_members tool first, then pass the resolved ID to the message tool.',
    ];
}
