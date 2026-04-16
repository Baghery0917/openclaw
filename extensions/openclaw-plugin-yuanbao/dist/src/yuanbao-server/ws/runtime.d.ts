import type { YuanbaoWsClient } from './client.js';
export declare function setActiveWsClient(accountId: string, client: YuanbaoWsClient | null): void;
export declare function getActiveWsClient(accountId: string): YuanbaoWsClient | null;
export declare function getAllActiveWsClients(): ReadonlyMap<string, YuanbaoWsClient>;
