import type { GroupConfig } from './types.js';
export declare function parseGroupConfig(yamlContent: string): GroupConfig;
export declare function loadGroupConfig(groupDir: string): Promise<GroupConfig>;
