export const videoHandler = {
    msgType: 'TIMVideoFileElem',
    extract(_ctx, _elem, _resData) {
        return '[video]';
    },
    buildMsgBody(data) {
        return [
            {
                msg_type: 'TIMVideoFileElem',
                msg_content: {
                    video_url: data.videoUrl,
                    ...(data.videoUuid ? { video_uuid: data.videoUuid } : {}),
                    ...(data.videoSize ? { video_size: data.videoSize } : {}),
                    ...(data.videoSecond ? { video_second: data.videoSecond } : {}),
                    ...(data.videoFormat ? { video_format: data.videoFormat } : {}),
                    ...(data.thumbUrl ? { thumb_url: data.thumbUrl } : {}),
                    ...(data.thumbUuid ? { thumb_uuid: data.thumbUuid } : {}),
                    ...(data.thumbSize ? { thumb_size: data.thumbSize } : {}),
                    ...(data.thumbWidth ? { thumb_width: data.thumbWidth } : {}),
                    ...(data.thumbHeight ? { thumb_height: data.thumbHeight } : {}),
                    ...(data.thumbFormat ? { thumb_format: data.thumbFormat } : {}),
                },
            },
        ];
    },
};
