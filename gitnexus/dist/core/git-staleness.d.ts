/**
 * Git working tree vs index commit staleness (used by MCP resources, group status, etc.).
 * Lives in core/ so application code does not depend on the MCP package layer.
 */
export interface StalenessInfo {
    isStale: boolean;
    commitsBehind: number;
    hint?: string;
}
/**
 * Check how many commits the index is behind HEAD (synchronous; uses git CLI).
 */
export declare function checkStaleness(repoPath: string, lastCommit: string): StalenessInfo;
