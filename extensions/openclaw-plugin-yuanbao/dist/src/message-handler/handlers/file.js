export const fileHandler = {
    msgType: 'TIMFileElem',
    extract(_ctx, elem, resData) {
        const fileUrl = elem.msg_content?.url;
        const fileName = elem.msg_content?.file_name;
        if (fileUrl) {
            resData.medias.push({ mediaType: 'file', url: fileUrl, mediaName: fileName });
            return fileName ? `[${fileName}]` : `[file${resData.medias.filter(m => m.mediaType === 'file').length}]`;
        }
        return '[file]';
    },
    buildMsgBody(data) {
        return [
            {
                msg_type: 'TIMFileElem',
                msg_content: {
                    url: data.url,
                    ...(data.fileName ? { file_name: data.fileName } : {}),
                    ...(data.fileSize ? { file_size: data.fileSize } : {}),
                    ...(data.uuid ? { uuid: data.uuid } : {}),
                },
            },
        ];
    },
};
