/**
 * Git Clone Utility
 *
 * Shallow-clones repositories into ~/.gitnexus/repos/{name}/.
 * If already cloned, does git pull instead.
 */
/** Extract the repository name from a git URL (HTTPS or SSH). */
export declare function extractRepoName(url: string): string;
/** Get the clone target directory for a repo name. */
export declare function getCloneDir(repoName: string): string;
/**
 * Validate a git URL to prevent SSRF attacks.
 * Only allows https:// and http:// schemes. Blocks private/internal addresses,
 * IPv6 private ranges, cloud metadata hostnames, and numeric IP encodings.
 */
export declare function validateGitUrl(url: string): void;
export interface CloneProgress {
    phase: 'cloning' | 'pulling';
    message: string;
}
/**
 * Clone or pull a git repository.
 * If targetDir doesn't exist: git clone --depth 1
 * If targetDir exists with .git: git pull --ff-only
 */
export declare function cloneOrPull(url: string, targetDir: string, onProgress?: (progress: CloneProgress) => void): Promise<string>;
