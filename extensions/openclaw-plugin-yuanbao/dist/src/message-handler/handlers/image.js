export const imageHandler = {
    msgType: 'TIMImageElem',
    extract(_ctx, elem, resData) {
        const imageInfoArray = elem.msg_content?.image_info_array;
        const imageInfo = imageInfoArray?.[1] || imageInfoArray?.[0];
        if (imageInfo?.url) {
            resData.medias.push({ mediaType: 'image', url: imageInfo.url });
            return `[image${resData.medias.filter(m => m.mediaType === 'image').length}]`;
        }
        return undefined;
    },
    buildMsgBody(data) {
        const imageInfoArray = data.imageInfoArray ?? [
            {
                type: 1,
                url: data.url,
            },
        ];
        return [
            {
                msg_type: 'TIMImageElem',
                msg_content: {
                    ...(data.uuid ? { uuid: data.uuid } : {}),
                    ...(data.imageFormat ? { image_format: data.imageFormat } : {}),
                    image_info_array: imageInfoArray,
                },
            },
        ];
    },
};
