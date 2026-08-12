/**
 * Local Backend (Multi-Repo)
 *
 * Provides tool implementations using local .gitnexus/ indexes.
 * Supports multiple indexed repositories via a global registry.
 * LadybugDB connections are opened lazily per repo on first query.
 */
import { isWriteQuery } from '../../core/lbug/pool-adapter.js';
export { isWriteQuery };
import { type RegistryEntry } from '../../storage/repo-manager.js';
import { GroupService } from '../../core/group/service.js';
/**
 * Quick test-file detection for filtering impact results.
 * Matches common test file patterns across all supported languages.
 */
export declare function isTestFilePath(filePath: string): boolean;
/** Valid LadybugDB node labels for safe Cypher query construction */
export declare const VALID_NODE_LABELS: Set<string>;
/** Valid relation types for impact analysis filtering */
export declare const VALID_RELATION_TYPES: Set<string>;
/**
 * Per-relation-type confidence floor for impact analysis.
 *
 * When the graph stores a relation with a confidence value, that stored
 * value is used as-is (it reflects resolution-tier accuracy from analysis
 * time).  This map provides the floor for each edge type when no stored
 * confidence is available, and is also used for display / tooltip hints.
 *
 * Rationale:
 *   CALLS / IMPORTS  – direct, strongly-typed references → 0.9
 *   EXTENDS          – class hierarchy, statically verifiable → 0.85
 *   IMPLEMENTS       – interface contract, statically verifiable → 0.85
 *   METHOD_OVERRIDES  – method override, statically verifiable → 0.85
 *   METHOD_IMPLEMENTS – interface method implementation, statically verifiable → 0.85
 *   HAS_METHOD       – structural containment → 0.95
 *   HAS_PROPERTY     – structural containment → 0.95
 *   ACCESSES         – field read/write, may be indirect → 0.8
 *   CONTAINS         – folder/file containment → 0.95
 *   (unknown type)   – conservative fallback → 0.5
 */
export declare const IMPACT_RELATION_CONFIDENCE: Readonly<Record<string, number>>;
export interface CodebaseContext {
    projectName: string;
    stats: {
        fileCount: number;
        functionCount: number;
        communityCount: number;
        processCount: number;
    };
}
interface RepoHandle {
    id: string;
    name: string;
    repoPath: string;
    storagePath: string;
    lbugPath: string;
    indexedAt: string;
    lastCommit: string;
    stats?: RegistryEntry['stats'];
}
export declare class LocalBackend {
    private repos;
    private contextCache;
    private initializedRepos;
    private reinitPromises;
    private lastStalenessCheck;
    private groupToolSvc;
    /**
     * Cross-repo group tools (CLI). Shares logic with MCP `group_*` handlers.
     */
    getGroupService(): GroupService;
    /** Close all pooled LadybugDB connections (CLI one-shot; optional for long-lived MCP). */
    dispose(): Promise<void>;
    /**
     * Initialize from the global registry.
     * Returns true if at least one repo is available.
     */
    init(): Promise<boolean>;
    /**
     * Re-read the global registry and update the in-memory repo map.
     * New repos are added, existing repos are updated, removed repos are pruned.
     * LadybugDB connections for removed repos are NOT closed (they idle-timeout naturally).
     */
    private refreshRepos;
    /**
     * Generate a stable repo ID from name + path.
     * If names collide, append a hash of the path.
     */
    private repoId;
    /**
     * Resolve which repo to use.
     * - If repoParam is given, match by name or path
     * - If only 1 repo, use it
     * - If 0 or multiple without param, throw with helpful message
     *
     * On a miss, re-reads the registry once in case a new repo was indexed
     * while the MCP server was running.
     */
    resolveRepo(repoParam?: string): Promise<RepoHandle>;
    /**
     * Try to resolve a repo from the in-memory cache. Returns null on miss.
     */
    private resolveRepoFromCache;
    private ensureInitialized;
    /**
     * Get context for a specific repo (or the single repo if only one).
     */
    getContext(repoId?: string): CodebaseContext | null;
    /**
     * List all registered repos with their metadata.
     * Re-reads the global registry so newly indexed repos are discovered
     * without restarting the MCP server.
     */
    listRepos(): Promise<Array<{
        name: string;
        path: string;
        indexedAt: string;
        lastCommit: string;
        stats?: any;
    }>>;
    callTool(method: string, params: any): Promise<any>;
    /**
     * Query tool — process-grouped search.
     *
     * 1. Hybrid search (BM25 + semantic) to find matching symbols
     * 2. Trace each match to its process(es) via STEP_IN_PROCESS
     * 3. Group by process, rank by aggregate relevance + internal cluster cohesion
     * 4. Return: { processes, process_symbols, definitions }
     */
    private query;
    /**
     * BM25 keyword search helper - uses LadybugDB FTS for always-fresh results
     */
    private bm25Search;
    /**
     * Semantic vector search helper
     */
    private semanticSearch;
    executeCypher(repoName: string, query: string): Promise<any>;
    private cypher;
    /**
     * Format raw Cypher result rows as a markdown table for LLM readability.
     * Falls back to raw result if rows aren't tabular objects.
     */
    private formatCypherAsMarkdown;
    /**
     * Aggregate same-named clusters: group by heuristicLabel, sum symbols,
     * weighted-average cohesion, filter out tiny clusters (<5 symbols).
     * Raw communities stay intact in LadybugDB for Cypher queries.
     */
    private aggregateClusters;
    private overview;
    /**
     * Patch the `type` field on candidates whose `labels(n)[0]` projection
     * came back empty — a known LadybugDB behaviour for several node types.
     *
     * Uses one scoped UNION query across the five priority labels rather
     * than per-candidate round-trips, so cost is a single DB call regardless
     * of how many candidates need enrichment. No-op when every candidate
     * already has a non-empty type.
     *
     * Failures are swallowed: label enrichment is an optimisation for
     * downstream scoring and #480 Class/Interface BFS seeding; if it fails
     * the symbol still resolves, just without the kind-priority bonus.
     */
    private enrichCandidateLabels;
    /**
     * Score a symbol candidate for disambiguation ranking.
     *
     * Deterministic, no DB round-trip:
     *   - base 0.50
     *   - +0.40 when file_path hint matches (substring, case-insensitive)
     *   - +0.20 when kind hint exactly matches the candidate's kind
     *   - when no kind hint, a small priority bonus (Class > Interface >
     *     Function > Method > Constructor) to preserve the intuition that
     *     class-level names are usually what the user wanted.
     *
     * Capped at 1.0. Intentionally simple and inspectable — a future v2 can
     * plug in BM25/embedding signals here without changing the surrounding
     * resolver shape.
     */
    private scoreCandidate;
    /**
     * Shared symbol resolver used by `context` and `impact`.
     *
     * Returns one of:
     *   - `{ kind: 'ok', symbol, resolvedLabel }` — single confident match
     *     (either direct UID, only one candidate after filtering, Class/
     *     Constructor collapse, or a top-scoring candidate with a clear gap
     *     to the runner-up).
     *   - `{ kind: 'ambiguous', candidates }` — multiple viable matches,
     *     sorted by score desc. Each candidate carries a relevance score.
     *   - `{ kind: 'not_found' }` — no matches at all.
     *
     * Preserves the #480 Class/Constructor preference: when the only
     * ambiguity is between a Class and its own Constructor (same name,
     * same filePath), the Class wins silently.
     */
    private resolveSymbolCandidates;
    /**
     * Context tool — 360-degree symbol view with categorized refs.
     * Disambiguation (ranked) when multiple symbols share a name.
     * UID-based direct lookup. No cluster in output.
     */
    private context;
    /**
     * Legacy explore — kept for backwards compatibility with resources.ts.
     * Routes cluster/process types to direct graph queries.
     */
    private explore;
    /**
     * Detect changes — git-diff based impact analysis.
     * Maps changed lines to indexed symbols, then finds affected processes.
     */
    private detectChanges;
    /**
     * Rename tool — multi-file coordinated rename using graph + text search.
     * Graph refs are tagged "graph" (high confidence).
     * Additional refs found via text search are tagged "text_search" (lower confidence).
     */
    private rename;
    private impact;
    private _impactImpl;
    /**
     * Shared BFS traversal for impact analysis (name-resolved or UID-resolved symbol).
     */
    private _runImpactBFS;
    /**
     * UID-based impact for cross-repo fan-out. Same result shape as `impact`.
     * Returns null if the repo is unknown, the UID is missing, or analysis fails.
     */
    impactByUid(repoId: string, uid: string, direction: string, opts: {
        maxDepth: number;
        relationTypes: string[];
        minConfidence: number;
        includeTests: boolean;
    }): Promise<any | null>;
    private handleGroupTool;
    private groupList;
    private groupSync;
    private groupContracts;
    private groupQuery;
    private groupStatus;
    /**
     * Fetch Route nodes with their consumers in a single query.
     * Shared by routeMap and shapeCheck to avoid N+1 query patterns.
     */
    private fetchRoutesWithConsumers;
    /**
     * Batch-fetch execution flows linked to a set of Route or Tool nodes.
     * Single query instead of N+1.
     */
    private fetchLinkedFlowsBatch;
    private routeMap;
    private shapeCheck;
    private toolMap;
    private apiImpact;
    /**
     * Query clusters (communities) directly from graph.
     * Used by getClustersResource — avoids legacy overview() dispatch.
     */
    queryClusters(repoName?: string, limit?: number): Promise<{
        clusters: any[];
    }>;
    /**
     * Query processes directly from graph.
     * Used by getProcessesResource — avoids legacy overview() dispatch.
     */
    queryProcesses(repoName?: string, limit?: number): Promise<{
        processes: any[];
    }>;
    /**
     * Query cluster detail (members) directly from graph.
     * Used by getClusterDetailResource.
     */
    queryClusterDetail(name: string, repoName?: string): Promise<any>;
    /**
     * Query process detail (steps) directly from graph.
     * Used by getProcessDetailResource.
     */
    queryProcessDetail(name: string, repoName?: string): Promise<any>;
    disconnect(): Promise<void>;
}
