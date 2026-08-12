import lbug from '@ladybugdb/core';
import { KnowledgeGraph } from '../graph/types.js';
import type { CachedEmbedding } from '../embeddings/types.js';
/** Factory for creating WriteStreams — injectable for testing. */
export type WriteStreamFactory = (filePath: string) => import('fs').WriteStream;
/** Result of splitting the relationship CSV into per-label-pair files. */
export interface RelCsvSplitResult {
    relHeader: string;
    relsByPairMeta: Map<string, {
        csvPath: string;
        rows: number;
    }>;
    pairWriteStreams: Map<string, import('fs').WriteStream>;
    skippedRels: number;
    totalValidRels: number;
}
/**
 * Split a relationship CSV into per-label-pair files on disk.
 *
 * Streams the CSV line-by-line, routing each relationship to a file named
 * `rel_{fromLabel}_{toLabel}.csv`. Handles backpressure correctly: only one
 * drain listener per stream at a time, and readline resumes only when ALL
 * backpressured streams have drained.
 *
 * @param csvPath       Path to the combined relationship CSV
 * @param csvDir        Directory to write per-pair CSV files
 * @param validTables   Set of valid node table names
 * @param getNodeLabel  Function to extract the label from a node ID
 * @param wsFactory     Optional WriteStream factory (defaults to fs.createWriteStream)
 */
export declare const splitRelCsvByLabelPair: (csvPath: string, csvDir: string, validTables: Set<string>, getNodeLabel: (id: string) => string, wsFactory?: WriteStreamFactory) => Promise<RelCsvSplitResult>;
/** Expose the current Database for pool adapter reuse in tests. */
export declare const getDatabase: () => lbug.Database | null;
/**
 * Return true when the error message indicates that another process holds
 * an exclusive lock on the LadybugDB file (e.g. `gitnexus analyze` or
 * `gitnexus serve` running at the same time).
 */
export declare const isDbBusyError: (err: unknown) => boolean;
export declare const initLbug: (dbPath: string) => Promise<{
    db: lbug.Database;
    conn: lbug.Connection;
}>;
/**
 * Execute multiple queries against one repo DB atomically.
 * While the callback runs, no other request can switch the active DB.
 *
 * Automatically retries up to DB_LOCK_RETRY_ATTEMPTS times when the
 * database is busy (e.g. `gitnexus analyze` holds the write lock).
 * Each retry waits DB_LOCK_RETRY_DELAY_MS * attempt milliseconds.
 */
export declare const withLbugDb: <T>(dbPath: string, operation: () => Promise<T>) => Promise<T>;
export type LbugProgressCallback = (message: string) => void;
export declare const loadGraphToLbug: (graph: KnowledgeGraph, repoPath: string, storagePath: string, onProgress?: LbugProgressCallback) => Promise<{
    success: boolean;
    insertedRels: number;
    skippedRels: number;
    warnings: string[];
}>;
/**
 * Insert a single node to LadybugDB
 * @param label - Node type (File, Function, Class, etc.)
 * @param properties - Node properties
 * @param dbPath - Path to LadybugDB database (optional if already initialized)
 */
export declare const insertNodeToLbug: (label: string, properties: Record<string, any>, dbPath?: string) => Promise<boolean>;
/**
 * Batch insert multiple nodes to LadybugDB using a single connection
 * @param nodes - Array of {label, properties} to insert
 * @param dbPath - Path to LadybugDB database
 * @returns Object with success count and error count
 */
export declare const batchInsertNodesToLbug: (nodes: Array<{
    label: string;
    properties: Record<string, any>;
}>, dbPath: string) => Promise<{
    inserted: number;
    failed: number;
}>;
export declare const executeQuery: (cypher: string) => Promise<any[]>;
export declare const streamQuery: (cypher: string, onRow: (row: any) => void | Promise<void>) => Promise<number>;
/**
 * Execute a single parameterized query (prepare/execute pattern).
 * Prevents Cypher injection by binding values as parameters.
 */
export declare const executePrepared: (cypher: string, params: Record<string, any>) => Promise<any[]>;
export declare const executeWithReusedStatement: (cypher: string, paramsList: Array<Record<string, any>>) => Promise<void>;
export declare const getLbugStats: () => Promise<{
    nodes: number;
    edges: number;
}>;
/**
 * Load cached embeddings from LadybugDB before a rebuild.
 * Returns all embedding vectors so they can be re-inserted after the graph is reloaded,
 * avoiding expensive re-embedding of unchanged nodes.
 *
 * Detects old schema (no chunkIndex column) and returns empty cache to trigger rebuild.
 */
export declare const loadCachedEmbeddings: () => Promise<{
    embeddingNodeIds: Set<string>;
    embeddings: CachedEmbedding[];
}>;
/**
 * Fetch existing embedding hashes from CodeEmbedding table for incremental embedding.
 * Returns a Map<nodeId, contentHash> suitable for passing to `runEmbeddingPipeline`.
 * Handles legacy DBs without the `contentHash` column (all rows treated as stale with empty hash).
 * Returns undefined if the CodeEmbedding table does not exist.
 *
 * @param execQuery - Cypher query executor (typically pool-adapter's `executeQuery`)
 */
export declare const fetchExistingEmbeddingHashes: (execQuery: (cypher: string) => Promise<any[]>) => Promise<Map<string, string> | undefined>;
export declare const closeLbug: () => Promise<void>;
export declare const isLbugReady: () => boolean;
/**
 * Delete all nodes (and their relationships) for a specific file from LadybugDB
 * @param filePath - The file path to delete nodes for
 * @param dbPath - Optional path to LadybugDB for per-query connection
 * @returns Object with counts of deleted nodes
 */
export declare const deleteNodesForFile: (filePath: string, dbPath?: string) => Promise<{
    deletedNodes: number;
}>;
export declare const getEmbeddingTableName: () => string;
/**
 * Load the FTS extension (required before using FTS functions).
 * Safe to call multiple times — tracks loaded state via module-level ftsLoaded.
 */
export declare const loadFTSExtension: () => Promise<void>;
/**
 * Load the VECTOR extension (required before using QUERY_VECTOR_INDEX).
 * Safe to call multiple times -- tracks loaded state via module-level vectorExtensionLoaded.
 */
export declare const loadVectorExtension: () => Promise<void>;
/**
 * Create a full-text search index on a table
 * @param tableName - The node table name (e.g., 'File', 'CodeSymbol')
 * @param indexName - Name for the FTS index
 * @param properties - List of properties to index (e.g., ['name', 'code'])
 * @param stemmer - Stemming algorithm (default: 'porter')
 */
export declare const createFTSIndex: (tableName: string, indexName: string, properties: string[], stemmer?: string) => Promise<void>;
/**
 * Query a full-text search index
 * @param tableName - The node table name
 * @param indexName - FTS index name
 * @param query - Search query string
 * @param limit - Maximum results
 * @param conjunctive - If true, all terms must match (AND); if false, any term matches (OR)
 * @returns Array of { node properties, score }
 */
export declare const queryFTS: (tableName: string, indexName: string, query: string, limit?: number, conjunctive?: boolean) => Promise<Array<{
    nodeId: string;
    name: string;
    filePath: string;
    score: number;
    [key: string]: any;
}>>;
/**
 * Drop an FTS index
 */
export declare const dropFTSIndex: (tableName: string, indexName: string) => Promise<void>;
