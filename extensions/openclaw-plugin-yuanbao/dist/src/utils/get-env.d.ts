import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
export declare const getPluginVersion: () => string;
export declare const getOpenclawVersion: () => string;
export declare const getOperationSystem: () => string;
export declare const initEnv: (api: OpenClawPluginApi) => void;
