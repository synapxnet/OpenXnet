/**
 * Shared Analysis Orchestrator
 *
 * Extracts the core analysis pipeline from the CLI analyze command into a
 * reusable function that can be called from both the CLI and a server-side
 * worker process.
 *
 * IMPORTANT: This module must NEVER call process.exit(). The caller (CLI
 * wrapper or server worker) is responsible for process lifecycle.
 */
export interface AnalyzeCallbacks {
    onProgress: (phase: string, percent: number, message: string) => void;
    onLog?: (message: string) => void;
}
export interface AnalyzeOptions {
    /**
     * Force a full re-index of the pipeline. Callers may OR this with
     * other flags that imply re-analysis (e.g. `--skills`), so the value
     * here is the PIPELINE-force signal, NOT the registry-collision
     * bypass. See `allowDuplicateName` below.
     */
    force?: boolean;
    embeddings?: boolean;
    skipGit?: boolean;
    /** Skip AGENTS.md and CLAUDE.md gitnexus block updates. */
    skipAgentsMd?: boolean;
    /** Omit volatile symbol/relationship counts from AGENTS.md and CLAUDE.md. */
    noStats?: boolean;
    /**
     * User-provided alias for the registry `name` (#829). When set,
     * forwarded to `registerRepo` so the indexed repo is stored under
     * this alias instead of the path-derived basename.
     */
    registryName?: string;
    /**
     * Bypass the `RegistryNameCollisionError` guard and allow two paths
     * to register under the same `name` (#829). Controlled by the
     * dedicated `--allow-duplicate-name` CLI flag, intentionally
     * independent from `--force` — users who hit the collision guard
     * should be able to accept the duplicate without paying the cost
     * of a pipeline re-index.
     */
    allowDuplicateName?: boolean;
}
export interface AnalyzeResult {
    repoName: string;
    repoPath: string;
    stats: {
        files?: number;
        nodes?: number;
        edges?: number;
        communities?: number;
        processes?: number;
        embeddings?: number;
    };
    alreadyUpToDate?: boolean;
    /** The raw pipeline result — only populated when needed by callers (e.g. skill generation). */
    pipelineResult?: any;
}
export declare const PHASE_LABELS: Record<string, string>;
/**
 * Run the full GitNexus analysis pipeline.
 *
 * This is the shared core extracted from the CLI `analyze` command. It
 * handles: pipeline execution, LadybugDB loading, FTS indexing, embedding
 * generation, metadata persistence, and AI context file generation.
 *
 * The function communicates progress and log messages exclusively through
 * the {@link AnalyzeCallbacks} interface — it never writes to stdout/stderr
 * directly and never calls `process.exit()`.
 */
export declare function runFullAnalysis(repoPath: string, options: AnalyzeOptions, callbacks: AnalyzeCallbacks): Promise<AnalyzeResult>;
