/**
 * Analyze Command
 *
 * Indexes a repository and stores the knowledge graph in .gitnexus/
 *
 * Delegates core analysis to the shared runFullAnalysis orchestrator.
 * This CLI wrapper handles: heap management, progress bar, SIGINT,
 * skill generation (--skills), summary output, and process.exit().
 */
export interface AnalyzeOptions {
    force?: boolean;
    embeddings?: boolean;
    skills?: boolean;
    verbose?: boolean;
    /** Skip AGENTS.md and CLAUDE.md gitnexus block updates. */
    skipAgentsMd?: boolean;
    /** Omit volatile symbol/relationship counts from AGENTS.md and CLAUDE.md. */
    noStats?: boolean;
    /** Index the folder even when no .git directory is present. */
    skipGit?: boolean;
    /**
     * Override the default basename-derived registry `name` with a
     * user-supplied alias (#829). Disambiguates repos whose paths share a
     * basename. Persisted — subsequent re-analyses of the same path without
     * `--name` preserve the alias.
     */
    name?: string;
    /**
     * Allow registration even when another path already uses the same
     * `--name` alias (#829). Intentionally a distinct flag from `--force`
     * because the user may want to coexist under the same name WITHOUT
     * paying the cost of a pipeline re-index. Maps to registerRepo's
     * `allowDuplicateName` option end-to-end.
     */
    allowDuplicateName?: boolean;
}
export declare const analyzeCommand: (inputPath?: string, options?: AnalyzeOptions) => Promise<void>;
