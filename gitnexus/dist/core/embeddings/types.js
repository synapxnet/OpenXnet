/**
 * Embedding Pipeline Types
 *
 * Type definitions for the embedding generation and semantic search system.
 */
/**
 * Node labels that need chunking (have code body, potentially long)
 */
export const CHUNKABLE_LABELS = [
    'Function',
    'Method',
    'Constructor',
    'Class',
    'Interface',
    'Struct',
    'Enum',
    'Trait',
    'Impl',
    'Macro',
    'Namespace',
];
/**
 * Node labels that are short (no chunking needed, embed directly)
 */
export const SHORT_LABELS = [
    'TypeAlias',
    'Typedef',
    'Const',
    'Property',
    'Record',
    'Union',
    'Static',
    'Variable',
];
/**
 * All embeddable labels (union of CHUNKABLE + SHORT)
 */
export const EMBEDDABLE_LABELS = [...CHUNKABLE_LABELS, ...SHORT_LABELS];
/**
 * Check if a label should be embedded
 */
export const isEmbeddableLabel = (label) => EMBEDDABLE_LABELS.includes(label);
/**
 * Check if a label needs chunking
 */
export const isChunkableLabel = (label) => CHUNKABLE_LABELS.includes(label);
/**
 * Check if a label is a short type (no chunking)
 */
export const isShortLabel = (label) => SHORT_LABELS.includes(label);
/**
 * Node labels that have structural names (methods/fields) extractable via AST
 */
export const STRUCTURAL_LABELS = new Set([
    'Class',
    'Struct',
    'Interface',
    'Enum',
]);
/**
 * Node labels that have isExported column in their schema
 */
export const LABELS_WITH_EXPORTED = new Set([
    'Function',
    'Class',
    'Interface',
    'Method',
    'CodeElement',
]);
/**
 * Default embedding configuration
 * Uses snowflake-arctic-embed-xs for browser efficiency
 * Tries WebGPU first (fast), user can choose WASM fallback if unavailable
 */
export const DEFAULT_EMBEDDING_CONFIG = {
    modelId: 'Snowflake/snowflake-arctic-embed-xs',
    batchSize: 16,
    dimensions: 384,
    device: 'auto',
    maxSnippetLength: 500,
    chunkSize: 1200,
    overlap: 120,
    maxDescriptionLength: 150,
};
/**
 * Deduplicate vector search chunk results by nodeId,
 * keeping the chunk with smallest distance for each node.
 */
export const dedupBestChunks = (rows, limit) => {
    const best = new Map();
    for (const row of rows) {
        const existing = best.get(row.nodeId);
        if (!existing || row.distance < existing.distance) {
            best.set(row.nodeId, {
                chunkIndex: row.chunkIndex,
                startLine: row.startLine,
                endLine: row.endLine,
                distance: row.distance,
            });
        }
        if (limit !== undefined && best.size >= limit)
            break;
    }
    return best;
};
const DEFAULT_FETCH_MULTIPLIER = 4;
const DEFAULT_FETCH_BUFFER = 8;
const DEFAULT_MAX_FETCH = 200;
/**
 * Fetch vector-search chunks until we have enough unique nodeIds
 * or can tell the result set is exhausted.
 */
export const collectBestChunks = async (limit, fetchRows, maxFetch = DEFAULT_MAX_FETCH) => {
    if (limit <= 0)
        return new Map();
    let fetchLimit = Math.max(limit * DEFAULT_FETCH_MULTIPLIER, limit + DEFAULT_FETCH_BUFFER);
    let previousFetchLimit = 0;
    while (fetchLimit > previousFetchLimit) {
        const rows = await fetchRows(fetchLimit);
        const bestChunks = dedupBestChunks(rows, limit);
        if (bestChunks.size >= limit || rows.length < fetchLimit) {
            return bestChunks;
        }
        previousFetchLimit = fetchLimit;
        fetchLimit = fetchLimit >= maxFetch ? fetchLimit * 2 : Math.min(maxFetch, fetchLimit * 2);
    }
    return new Map();
};
