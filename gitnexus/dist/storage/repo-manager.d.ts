/**
 * Repository Manager
 *
 * Manages GitNexus index storage in .gitnexus/ at repo root.
 * Also maintains a global registry at ~/.gitnexus/registry.json
 * so the MCP server can discover indexed repos from any cwd.
 */
export interface RepoMeta {
    repoPath: string;
    lastCommit: string;
    indexedAt: string;
    stats?: {
        files?: number;
        nodes?: number;
        edges?: number;
        communities?: number;
        processes?: number;
        embeddings?: number;
    };
}
export interface IndexedRepo {
    repoPath: string;
    storagePath: string;
    lbugPath: string;
    metaPath: string;
    meta: RepoMeta;
}
/**
 * Shape of an entry in the global registry (~/.gitnexus/registry.json)
 */
export interface RegistryEntry {
    name: string;
    path: string;
    storagePath: string;
    indexedAt: string;
    lastCommit: string;
    stats?: RepoMeta['stats'];
}
/**
 * Get the .gitnexus storage path for a repository
 */
export declare const getStoragePath: (repoPath: string) => string;
/**
 * Get paths to key storage files
 */
export declare const getStoragePaths: (repoPath: string) => {
    storagePath: string;
    lbugPath: string;
    metaPath: string;
};
/**
 * Check whether a KuzuDB index exists in the given storage path.
 * Non-destructive — safe to call from status commands.
 */
export declare const hasKuzuIndex: (storagePath: string) => Promise<boolean>;
/**
 * Clean up stale KuzuDB files after migration to LadybugDB.
 *
 * Returns:
 *   found        — true if .gitnexus/kuzu existed and was deleted
 *   needsReindex — true if kuzu existed but lbug does not (re-analyze required)
 *
 * Callers own the user-facing messaging; this function only deletes files.
 */
export declare const cleanupOldKuzuFiles: (storagePath: string) => Promise<{
    found: boolean;
    needsReindex: boolean;
}>;
/**
 * Load metadata from an indexed repo
 */
export declare const loadMeta: (storagePath: string) => Promise<RepoMeta | null>;
/**
 * Save metadata to storage
 */
export declare const saveMeta: (storagePath: string, meta: RepoMeta) => Promise<void>;
/**
 * Check if a path has a GitNexus index
 */
export declare const hasIndex: (repoPath: string) => Promise<boolean>;
/**
 * Load an indexed repo from a path
 */
export declare const loadRepo: (repoPath: string) => Promise<IndexedRepo | null>;
/**
 * Find .gitnexus by walking up from a starting path
 */
export declare const findRepo: (startPath: string) => Promise<IndexedRepo | null>;
/**
 * Add .gitnexus to .gitignore if not already present
 */
export declare const addToGitignore: (repoPath: string) => Promise<void>;
/**
 * Get the path to the global GitNexus directory
 */
export declare const getGlobalDir: () => string;
/**
 * Get the path to the global registry file
 */
export declare const getGlobalRegistryPath: () => string;
/**
 * Read the global registry. Returns empty array if not found.
 */
export declare const readRegistry: () => Promise<RegistryEntry[]>;
/**
 * Options for {@link registerRepo}. All optional — callers without any
 * disambiguation requirement can keep calling `registerRepo(path, meta)`
 * unchanged.
 */
export interface RegisterRepoOptions {
    /**
     * User-provided alias from `analyze --name <alias>` (#829). Overrides
     * the default basename-derived registry `name`. Persisted — subsequent
     * re-analyses of the same path without `--name` preserve the alias.
     */
    name?: string;
    /**
     * Allow two DIFFERENT repo paths to register under the same alias
     * (#829). Mapped from the `--allow-duplicate-name` CLI flag.
     *
     * Scope: this flag governs cross-path alias sharing only — one repo
     * path always has exactly one registry entry (and therefore exactly
     * one alias). Re-analyzing the same path with `--name Y` overwrites
     * a previous `--name X`; it does NOT create a second entry or a
     * second alias for the same path (see the upsert-by-resolved-path
     * logic in {@link registerRepo} and the
     * `re-registerRepo with a different name overrides the previous
     * alias` test in `test/unit/repo-manager.test.ts`).
     *
     * Distinct from `--force` (which only triggers pipeline re-index);
     * a user accepting a duplicate alias should not be forced to also
     * re-run the full pipeline.
     */
    allowDuplicateName?: boolean;
}
/**
 * Thrown by {@link registerRepo} when a requested name is already in
 * use by a DIFFERENT path. The CLI layer surfaces this as an actionable
 * error instead of relying on `.message` string-matching.
 *
 * The colliding alias is exposed as `err.registryName` (not `err.name`).
 * `err.name` keeps its inherited `Error.prototype.name` semantics (the
 * class name) so downstream code can do the usual `err.name ===
 * 'RegistryNameCollisionError'` checks; use the `kind` discriminant or
 * `instanceof RegistryNameCollisionError` for type-safe narrowing.
 */
export declare class RegistryNameCollisionError extends Error {
    readonly registryName: string;
    readonly existingPath: string;
    readonly requestedPath: string;
    readonly kind: "RegistryNameCollisionError";
    constructor(registryName: string, existingPath: string, requestedPath: string);
}
/**
 * Register (add or update) a repo in the global registry.
 * Called after `gitnexus analyze` completes.
 *
 * Name resolution precedence (#829, #979):
 *   1. explicit `opts.name` (from `analyze --name <alias>`)
 *   2. preserved alias on an existing entry for this path
 *   3. `git config --get remote.origin.url` repo name (#979 — recovers
 *      a meaningful name for monorepo subprojects, git worktrees, and
 *      Gas-Town-style `<rig>/refinery/rig/` layouts where the basename
 *      is generic)
 *   4. `path.basename(repoPath)` (the original default)
 *
 * Duplicate-name guard: if another path already uses the resolved
 * `name`, throw {@link RegistryNameCollisionError} unless
 * `opts.allowDuplicateName` is set. The guard ONLY fires when the user explicitly passed a
 * `name`; un-aliased basename collisions continue to register silently
 * so existing users who don't know about `--name` see no behaviour
 * change.
 *
 * Returns the `name` that was actually written to the registry — the
 * caller can re-use it to keep AGENTS.md / skill files aligned with the
 * MCP-visible repo name (#979).
 */
export declare const registerRepo: (repoPath: string, meta: RepoMeta, opts?: RegisterRepoOptions) => Promise<string>;
/**
 * Remove a repo from the global registry.
 * Called after `gitnexus clean`.
 */
export declare const unregisterRepo: (repoPath: string) => Promise<void>;
/**
 * List all registered repos from the global registry.
 * Optionally validates that each entry's .gitnexus/ still exists.
 */
export declare const listRegisteredRepos: (opts?: {
    validate?: boolean;
}) => Promise<RegistryEntry[]>;
export interface CLIConfig {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    provider?: 'openai' | 'openrouter' | 'azure' | 'custom' | 'cursor';
    cursorModel?: string;
    /** Azure api-version query param (e.g. '2024-10-21'). Only used when provider is 'azure'. */
    apiVersion?: string;
    /** Set true when the deployment is a reasoning model (o1, o3, o4-mini). Auto-detected for OpenAI; must be set for Azure deployments. */
    isReasoningModel?: boolean;
}
/**
 * Get the path to the global CLI config file
 */
export declare const getGlobalConfigPath: () => string;
/**
 * Load CLI config from ~/.gitnexus/config.json
 */
export declare const loadCLIConfig: () => Promise<CLIConfig>;
/**
 * Save CLI config to ~/.gitnexus/config.json
 */
export declare const saveCLIConfig: (config: CLIConfig) => Promise<void>;
