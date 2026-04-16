import { sendMsgBodyDirect } from '../message-handler/outbound.js';
export async function sendStickerYuanbao(params) {
    const { wsClient, toAccount, sticker, account, config, refMsgId, core, traceContext } = params;
    const msgBody = [
        {
            msg_type: 'TIMFaceElem',
            msg_content: {
                index: 0,
                data: JSON.stringify({
                    sticker_id: sticker.sticker_id,
                    package_id: sticker.package_id,
                    width: sticker.width,
                    height: sticker.height,
                    formats: sticker.formats,
                    name: sticker.name,
                }),
            },
        },
    ];
    try {
        return await sendMsgBodyDirect({
            account,
            config,
            target: toAccount,
            msgBody,
            wsClient,
            core,
            refMsgId,
            traceContext,
        });
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: errMsg };
    }
}
