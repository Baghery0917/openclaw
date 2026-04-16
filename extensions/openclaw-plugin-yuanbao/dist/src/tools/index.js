import { registerGroupTools } from './group.js';
import { registerMemberTools } from './member.js';
import { registerRemindTools } from './remind.js';
export function registerTools(api) {
    registerMemberTools(api);
    registerGroupTools(api);
    registerRemindTools(api);
}
