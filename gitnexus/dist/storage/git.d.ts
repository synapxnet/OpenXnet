export declare const isGitRepo: (repoPath: string) => boolean;
export declare const getCurrentCommit: (repoPath: string) => string;
/**
 * Find the git repository root from any path inside the repo
 */
export declare const getGitRoot: (fromPath: string) => string | null;
/**
 * Check whether a directory contains a .git entry (file or folder).
 *
 * This is intentionally a simple filesystem check rather than running
 * `git rev-parse`, so it works even when git is not installed or when
 * the directory is a git-worktree root (which has a .git file, not a
 * directory).  Use `isGitRepo` for a definitive git answer.
 *
 * @param dirPath - Absolute path to the directory to inspect.
 * @returns `true` when `.git` is present, `false` otherwise.
 */
export declare const hasGitDir: (dirPath: string) => boolean;
/**
 * Read `remote.origin.url` from a git repository, or `null` if not a
 * git repo, has no `origin` remote, or git is unavailable.
 *
 * Used by the registry-name inference path (#979) to recover a
 * meaningful repo name when `path.basename(repoPath)` is generic
 * (e.g. monorepo subprojects, git worktrees, Gas-Town-style
 * `<rig>/refinery/rig/` layouts).
 */
export declare const getRemoteOriginUrl: (repoPath: string) => string | null;
/**
 * Parse a repository name out of a git remote URL. Handles the common
 * SSH (`git@host:owner/repo.git`), HTTPS (`https://host/owner/repo.git`),
 * `git://`, `ssh://`, and `file://` shapes. Returns `null` for empty /
 * unparseable input.
 *
 * The heuristic: strip a trailing `.git` and trailing slashes, then
 * take the segment after the last `/` or `:`.
 */
export declare const parseRepoNameFromUrl: (url: string | null | undefined) => string | null;
/**
 * Convenience wrapper: derive a registry-friendly name from the repo's
 * `origin` remote, or `null` when it cannot be inferred.
 */
export declare const getInferredRepoName: (repoPath: string) => string | null;
export interface DiffHunk {
    startLine: number;
    endLine: number;
}
export interface FileDiff {
    filePath: string;
    hunks: DiffHunk[];
}
/**
 * Parse unified diff output (with -U0) into per-file hunk ranges.
 * Extracts the new-file line ranges from @@ hunk headers.
 */
export declare function parseDiffHunks(diffOutput: string): FileDiff[];
