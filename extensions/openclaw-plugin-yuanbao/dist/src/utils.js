export function msgBodyDesensitization(msg_body) {
    let log = '';
    msg_body.forEach((item) => {
        if (item.msg_type === 'TIMTextElem') {
            log += `[text:${textDesensitization(item.msg_content?.text) ?? '-'}]`;
        }
        else {
            log += `[${item.msg_type}:${JSON.stringify(item.msg_content)}]`;
        }
    });
    return log;
}
export function textDesensitization(text) {
    if (text.length > 5) {
        return `${text.slice(0, 2)}***(${text.length - 4})***${text.slice(-2)}`;
    }
    return text;
}
