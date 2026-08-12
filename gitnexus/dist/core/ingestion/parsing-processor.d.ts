import { KnowledgeGraph } from '../graph/types.js';
import type { SymbolTableWriter, ExtractedHeritage } from './model/index.js';
import { ASTCache } from './ast-cache.js';
import type { ParsedFile } from 'gitnexus-shared';
import { WorkerPool } from './workers/worker-pool.js';
import type { ExtractedImport, ExtractedCall, ExtractedAssignment, ExtractedRoute, ExtractedFetchCall, ExtractedDecoratorRoute, ExtractedToolDef, FileConstructorBindings, FileScopeBindings, ExtractedORMQuery } from './workers/parse-worker.js';
export type FileProgressCallback = (current: number, total: number, filePath: string) => void;
export interface WorkerExtractedData {
    imports: ExtractedImport[];
    calls: ExtractedCall[];
    assignments: ExtractedAssignment[];
    heritage: ExtractedHeritage[];
    routes: ExtractedRoute[];
    fetchCalls: ExtractedFetchCall[];
    decoratorRoutes: ExtractedDecoratorRoute[];
    toolDefs: ExtractedToolDef[];
    ormQueries: ExtractedORMQuery[];
    constructorBindings: FileConstructorBindings[];
    fileScopeBindings: FileScopeBindings[];
    /**
     * Per-file `ParsedFile` artifacts from the new scope-based resolution
     * pipeline (RFC #909 Ring 2). Empty until a provider implements
     * `emitScopeCaptures` — additive to the legacy DAG path. Aggregated
     * from every worker chunk; consumed downstream by #921's
     * finalize-orchestrator.
     */
    parsedFiles: ParsedFile[];
}
export declare const processParsing: (graph: KnowledgeGraph, files: {
    path: string;
    content: string;
}[], symbolTable: SymbolTableWriter, astCache: ASTCache, onFileProgress?: FileProgressCallback, workerPool?: WorkerPool) => Promise<WorkerExtractedData | null>;
