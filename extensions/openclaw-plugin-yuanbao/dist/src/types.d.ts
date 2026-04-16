export type YuanbaoDmConfig = {
    policy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
    allowFrom?: Array<string | number>;
};
export type YuanbaoOverflowPolicy = 'stop' | 'split';
export type YuanbaoReplyToMode = 'off' | 'first' | 'all';
export type YuanbaoLogInfoExt = {
    trace_id?: string;
};
export type YuanbaoConnectionMode = 'websocket';
export type YuanbaoAccountConfig = {
    name?: string;
    enabled?: boolean;
    appKey?: string;
    appSecret?: string;
    apiDomain?: string;
    logUploadApiUrl?: string;
    wsUrl?: string;
    token?: string;
    dm?: YuanbaoDmConfig;
    overflowPolicy?: YuanbaoOverflowPolicy;
    replyToMode?: YuanbaoReplyToMode;
    routeEnv?: string;
    mediaMaxMb?: number;
    historyLimit?: number;
    disableBlockStreaming?: boolean;
    requireMention?: boolean;
    fallbackReply?: string;
    markdownHintEnabled?: boolean;
};
export type YuanbaoConfig = YuanbaoAccountConfig & {
    accounts?: Record<string, YuanbaoAccountConfig>;
    defaultAccount?: string;
    routeEnv?: string;
    debugBotIds?: string[];
};
export type ResolvedYuanbaoAccount = {
    accountId: string;
    name?: string;
    enabled: boolean;
    configured: boolean;
    appKey?: string;
    appSecret?: string;
    botId?: string;
    apiDomain?: string;
    wsUrl?: string;
    token?: string;
    wsGatewayUrl: string;
    wsHeartbeatInterval?: number;
    wsMaxReconnectAttempts: number;
    overflowPolicy: YuanbaoOverflowPolicy;
    replyToMode: YuanbaoReplyToMode;
    mediaMaxMb: number;
    historyLimit: number;
    disableBlockStreaming: boolean;
    requireMention: boolean;
    fallbackReply?: string;
    markdownHintEnabled: boolean;
    config: YuanbaoAccountConfig;
};
export type ImImageInfoArrayItem = {
    type?: number;
    size?: number;
    width?: number;
    height?: number;
    url?: string;
};
export type YuanbaoMsgBodyElement = {
    msg_type: string;
    msg_content: {
        text?: string;
        uuid?: string;
        image_format?: number;
        data?: string;
        desc?: string;
        ext?: string;
        sound?: string;
        image_info_array?: ImImageInfoArrayItem[];
        index?: number;
        url?: string;
        file_size?: number;
        file_name?: string;
        [key: string]: unknown;
    };
};
export type ImMsgSeq = {
    msg_seq?: number;
    msg_id?: string;
};
export declare enum EnumCLawMsgType {
    CLAW_MSG_UNKNOWN = 0,
    CLAW_MSG_GROUP = 1,
    CLAW_MSG_PRIVATE = 2
}
export type YuanbaoInboundMessage = {
    callback_command?: string;
    from_account?: string;
    to_account?: string;
    sender_nickname?: string;
    group_id?: string;
    group_code?: string;
    group_name?: string;
    msg_seq?: number;
    msg_random?: number;
    msg_time?: number;
    msg_key?: string;
    msg_id?: string;
    online_only_flag?: number;
    send_msg_result?: number;
    error_info?: string;
    msg_body?: YuanbaoMsgBodyElement[];
    cloud_custom_data?: string;
    event_time?: number;
    bot_owner_id?: string;
    recall_msg_seq_list?: ImMsgSeq[];
    claw_msg_type?: EnumCLawMsgType;
    private_from_group_code?: string;
    trace_id?: string;
    seq_id?: string;
};
export type QuoteInfo = {
    id?: string;
    seq?: number;
    time?: number;
    type?: number;
    status?: number;
    desc?: string;
    sender_id?: string;
    sender_nickname?: string;
};
export type CloudCustomData = {
    env?: string;
    message_type?: number;
    quote?: QuoteInfo;
    source_group?: string;
    [key: string]: unknown;
};
export type YuanbaoSendMsgRequest = {
    sync_other_machine?: number;
    from_account?: string;
    to_account: string;
    msg_seq?: number;
    msg_random: number;
    msg_body: YuanbaoMsgBodyElement[];
    log_ext?: YuanbaoLogInfoExt;
    cloud_custom_data?: string;
    offline_push_info?: {
        push_flag?: number;
        desc?: string;
        ext?: string;
    };
};
export type YuanbaoSendMsgResponse = {
    action_status: string;
    error_code: number;
    error_info: string;
    msg_time?: number;
    msg_key?: string;
    msg_id?: string;
    msg_seq?: number;
    stream_msg_id?: string;
};
export type YuanbaoSendGroupMsgRequest = {
    group_code: string;
    random: number;
    msg_seq?: number;
    msg_body: YuanbaoMsgBodyElement[];
    from_account?: string;
    log_ext?: YuanbaoLogInfoExt;
    msg_priority?: string;
    cloud_custom_data?: string;
};
