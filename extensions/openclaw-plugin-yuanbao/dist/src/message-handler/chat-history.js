export const chatHistories = new Map();
const MEDIA_HISTORY_MAX_PER_GROUP = 50;
export const chatMediaHistories = new Map();
export function recordMediaHistory(groupCode, entry) {
    if (entry.medias.length === 0)
        return;
    let list = chatMediaHistories.get(groupCode);
    if (!list) {
        list = [];
        chatMediaHistories.set(groupCode, list);
    }
    list.push(entry);
    if (list.length > MEDIA_HISTORY_MAX_PER_GROUP) {
        list.splice(0, list.length - MEDIA_HISTORY_MAX_PER_GROUP);
    }
}
