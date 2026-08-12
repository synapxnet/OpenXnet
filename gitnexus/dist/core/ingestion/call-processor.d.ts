import { KnowledgeGraph } from '../graph/types.js';
import { ASTCache } from './ast-cache.js';
import type { SymbolDefinition } from 'gitnexus-shared';
import type { SymbolTableReader, HeritageMap, ExtractedHeritage } from './model/index.js';
import type { ResolutionContext } from './model/resolution-context.js';
import type { TieredCandidates } from './model/resolution-context.js';
import type { TypeEnvironment } from './type-env.js';
import type { BindingAccumulator } from './binding-accumulator.js';
import type { ExtractedCall, ExtractedAssignment, ExtractedRoute, ExtractedFetchCall, FileConstructorBindings } from './workers/parse-worker.js';
import type { LiteralTypeInferrer } from './type-extractors/types.js';
import type { SyntaxNode } from './utils/ast-helpers.js';
/** Per-file resolved type bindings for exported symbols.
 *  Populated during call processing, consumed by Phase 14 re-resolution pass. */
export type ExportedTypeMap = Map<string, Map<string, string>>;
/** Build a map of imported callee names → return types for cross-file call-result binding.
 *  Consulted ONLY when SymbolTable has no unambiguous local match (local-first principle).
 *
 *  Overlapping mechanism (1 of 3): this is the SymbolTable-backed path.
 *  See also:
 *    2. collectExportedBindings (~line 168) / enrichExportedTypeMap — TypeEnv + graph isExported
 *    3. Phase 9 fallback in verifyConstructorBindings (~line 563) — namedImportMap + BindingAccumulator
 *  A future cleanup should merge these into a single resolution pass. */
export declare function buildImportedReturnTypes(filePath: string, namedImportMap: ReadonlyMap<string, ReadonlyMap<string, {
    sourcePath: string;
    exportedName: string;
}>>, symbolTable: {
    lookupExactFull(filePath: string, name: string): {
        returnType?: string;
    } | undefined;
}): ReadonlyMap<string, string>;
/** Build cross-file RAW return types for imported callables.
 *  Unlike buildImportedReturnTypes (which stores extractReturnTypeName output),
 *  this stores the raw declared return type string (e.g., 'User[]', 'List<User>').
 *  Used by lookupRawReturnType for for-loop element extraction via extractElementTypeFromString. */
export declare function buildImportedRawReturnTypes(filePath: string, namedImportMap: ReadonlyMap<string, ReadonlyMap<string, {
    sourcePath: string;
    exportedName: string;
}>>, symbolTable: {
    lookupExactFull(filePath: string, name: string): {
        returnType?: string;
    } | undefined;
}): ReadonlyMap<string, string>;
/** Build ExportedTypeMap from graph nodes — used for worker path where TypeEnv
 *  is not available in the main thread. Collects returnType/declaredType from
 *  exported symbols that have callables with known return types. */
export declare function buildExportedTypeMapFromGraph(graph: KnowledgeGraph, symbolTable: SymbolTableReader): ExportedTypeMap;
/** Seed cross-file receiver types into pre-extracted call records.
 *  Fills missing receiverTypeName for single-hop imported variables
 *  using ExportedTypeMap + namedImportMap — zero disk I/O, zero AST re-parsing.
 *  Mutates calls in-place. Runs BEFORE processCallsFromExtracted. */
export declare function seedCrossFileReceiverTypes(calls: ExtractedCall[], namedImportMap: ReadonlyMap<string, ReadonlyMap<string, {
    sourcePath: string;
    exportedName: string;
}>>, exportedTypeMap: ReadonlyMap<string, ReadonlyMap<string, string>>): {
    enrichedCount: number;
};
/**
 * Resolution result with confidence scoring
 */
interface ResolveResult {
    nodeId: string;
    confidence: number;
    reason: string;
    returnType?: string;
}
export declare const processCalls: (graph: KnowledgeGraph, files: {
    path: string;
    content: string;
}[], astCache: ASTCache, ctx: ResolutionContext, onProgress?: (current: number, total: number) => void, exportedTypeMap?: ExportedTypeMap, 
/** Phase 14: pre-resolved cross-file bindings to seed into buildTypeEnv. Keyed by filePath → Map<localName, typeName>. */
importedBindingsMap?: ReadonlyMap<string, ReadonlyMap<string, string>>, 
/** Phase 14 E3: cross-file return types for imported callables. Keyed by filePath → Map<calleeName, returnType>.
 *  Consulted ONLY when SymbolTable has no unambiguous match (local-first principle). */
importedReturnTypesMap?: ReadonlyMap<string, ReadonlyMap<string, string>>, 
/** Phase 14 E3: cross-file RAW return types for for-loop element extraction. Keyed by filePath → Map<calleeName, rawReturnType>. */
importedRawReturnTypesMap?: ReadonlyMap<string, ReadonlyMap<string, string>>, heritageMap?: HeritageMap, bindingAccumulator?: BindingAccumulator) => Promise<ExtractedHeritage[]>;
/** Per-file cache for module-alias widening. Cleared between files. */
type WidenCache = Map<string, readonly SymbolDefinition[]>;
/**
 * Optional hints for overload disambiguation via argument literal types.
 * Only available on the sequential path (has AST); worker path passes undefined.
 *
 * @internal Exported so tests can exercise the D0 skip-condition path without
 *           constructing a real SyntaxNode. Do not use outside `call-processor.ts`
 *           and its unit tests.
 */
export interface OverloadHints {
    callNode: SyntaxNode;
    inferLiteralType: LiteralTypeInferrer;
    typeEnv?: TypeEnvironment;
}
/** @internal Exported for unit tests. Do not use outside tests. */
export declare const _resolveCallTargetForTesting: (call: Pick<ExtractedCall, "calledName" | "argCount" | "callForm" | "receiverTypeName" | "receiverName">, currentFile: string, ctx: ResolutionContext, opts?: {
    overloadHints?: OverloadHints;
    widenCache?: WidenCache;
    preComputedArgTypes?: (string | undefined)[];
    heritageMap?: HeritageMap;
}) => ResolveResult | null;
/**
 * Resolve a member call using owner-scoped + MRO resolution only (no fuzzy lookup).
 * Used for `obj.method()` calls where the receiver type is known.
 *
 * Delegates to {@link resolveMethodByOwner} which performs an O(1) owner-scoped
 * method lookup and, when a {@link HeritageMap} is provided, walks the MRO chain
 * via {@link lookupMethodByOwnerWithMRO}.
 *
 * {@link resolveCallTarget} delegates here for member calls.
 *
 * **SEMANTIC CHANGE (2026-04-09):** The confidence tier reflects how the
 * owner TYPE was resolved, not how the method NAME was resolved globally.
 * more accurate for owner-scoped resolution (the discriminant IS the class,
 * not the method name). Downstream consumers that filter CALLS edges by
 * confidence threshold may see shifted values on otherwise-unchanged code.
 * See the "returns result with correct confidence tier" tests below for the
 * locked-in behavior.
 *
 * **Performance:** Callers that only need the return type (e.g. `walkMixedChain`)
 * should call {@link resolveMethodByOwner} directly and use the `.def.returnType`
 * field instead, to avoid building a throwaway `ResolveResult`.
 *
 * @param ownerType   - The receiver's type name (e.g. 'User')
 * @param methodName  - The method being called (e.g. 'save')
 * @param currentFile - File path of the call site
 * @param ctx         - Resolution context
 * @param heritageMap - Optional heritage map for MRO-aware ancestor walking
 */
export declare const resolveMemberCall: (ownerType: string, methodName: string, currentFile: string, ctx: ResolutionContext, heritageMap?: HeritageMap, argCount?: number, ancestryView?: "instance" | "singleton") => ResolveResult | null;
/**
 * Resolve a free-function call using `lookupExact` (same-file) + import-scoped
 * resolution via `ctx.resolve()`.
 *
 * Used for `foo()`, `doStuff()` — unqualified calls with no receiver.
 * Also handles Swift/Kotlin implicit constructors (`User()` without `new`)
 * by delegating to {@link resolveStaticCall} when the tiered pool contains
 * class-like targets.
 *
 * {@link resolveCallTarget} delegates here for `callForm === 'free'`.
 *
 * `resolveFreeCall` does not take a `widenCache` parameter. Free calls
 * have no receiver type and rely exclusively on the tiered pool
 * from `ctx.resolve()`.
 *
 * @param calledName  - The called function name (e.g. 'doStuff')
 * @param filePath    - File path of the call site
 * @param ctx         - Resolution context
 * @param argCount    - Optional argument count for arity filtering
 * @param tieredOverride - Pre-computed tiered candidates from an upstream
 *                       `ctx.resolve` call. When provided, skips the redundant
 *                       lookup inside this function.
 * @param overloadHints  - Optional AST-based overload disambiguation hints
 * @param preComputedArgTypes - Optional pre-computed argument types (worker path)
 */
export declare const resolveFreeCall: (calledName: string, filePath: string, ctx: ResolutionContext, argCount?: number, tieredOverride?: TieredCandidates, overloadHints?: OverloadHints, preComputedArgTypes?: (string | undefined)[]) => ResolveResult | null;
/**
 * Resolve a constructor or static call using class-scoped lookup (no fuzzy lookup).
 * Used for `new User()` / `User()` calls where the calledName targets a class.
 *
 * Uses {@link TypeRegistry.lookupClassByName} for O(1) class lookup and
 * {@link MethodRegistry.lookupMethodByOwner} for constructor resolution.
 * {@link resolveCallTarget} delegates here for constructor and free-form calls
 * that target a class.
 *
 * Resolution strategy:
 *   1. `lookupClassByName(className)` — O(1) pre-check; bail early if no class exists.
 *   2. `ctx.resolve(className, currentFile)` — import-scoped tier for confidence.
 *   3. Filter to class-like candidates via `CLASS_LIKE_TYPES` and walk each
 *      with `lookupMethodByOwner(classNodeId, className, argCount)` — O(1)
 *      constructor lookup. Only accept results with `type === 'Constructor'`.
 *   4. If step 3 found nothing and the tiered pool contains ownerless
 *      `Constructor` nodes (common in some extractors), bail out so
 *      `filterCallableCandidates` downstream handles Constructor-vs-Class
 *      preference correctly.
 *   5. Class-node fallback: filter `classCandidates` through
 *      `INSTANTIABLE_CLASS_TYPES` and return the sole survivor when there is
 *      exactly one. Null-route on zero survivors (Interface / Trait / Impl
 *      stripped) or multiple (homonym ambiguity).
 *
 * @param className   - The class name (e.g. 'User'). Also used as the method
 *                       name for the `lookupMethodByOwner` scan, because the
 *                       only constructor-shaped call we handle today is
 *                       `ClassName(...)` / `new ClassName(...)`. Named
 *                       constructors like Dart `User.fromJson()` arrive as
 *                       member calls and route through `resolveMemberCall`,
 *                       so this function does not yet need a separate
 *                       `methodName` parameter. Revisit if a language surfaces
 *                       a static-method-shaped call with a distinct member
 *                       name.
 * @param currentFile - File path of the call site
 * @param ctx         - Resolution context
 * @param argCount    - Optional argument count for arity filtering
 * @param tieredOverride - Pre-computed tiered candidates for `className` from
 *                       an upstream `ctx.resolve` call. When provided, skips
 *                       the redundant lookup inside this function. Leave
 *                       unset for direct callers without a prior resolution.
 */
export declare const resolveStaticCall: (className: string, currentFile: string, ctx: ResolutionContext, argCount?: number, tieredOverride?: TieredCandidates, overloadHints?: OverloadHints, preComputedArgTypes?: (string | undefined)[]) => ResolveResult | null;
/**
 * Fast path: resolve pre-extracted call sites from workers.
 * No AST parsing — workers already extracted calledName + sourceId.
 *
 * @param bindingAccumulator  Phase 9: optional accumulator carrying file-scope
 *   TypeEnv bindings from all worker-processed files. When the SymbolTable has
 *   no return type for a cross-file callee, `verifyConstructorBindings` falls
 *   back to the accumulator via `namedImportMap` to bind the variable to the
 *   callee's resolved type (e.g. `var x = getUser()` → `x: User`).
 */
export declare const processCallsFromExtracted: (graph: KnowledgeGraph, extractedCalls: ExtractedCall[], ctx: ResolutionContext, onProgress?: (current: number, total: number) => void, constructorBindings?: FileConstructorBindings[], heritageMap?: HeritageMap, bindingAccumulator?: BindingAccumulator) => Promise<void>;
/**
 * Resolve pre-extracted field write assignments to ACCESSES {reason: 'write'} edges.
 * Accepts optional constructorBindings for return-type-aware receiver inference,
 * mirroring processCallsFromExtracted's verified binding lookup.
 */
export declare const processAssignmentsFromExtracted: (graph: KnowledgeGraph, assignments: ExtractedAssignment[], ctx: ResolutionContext, constructorBindings?: FileConstructorBindings[], bindingAccumulator?: BindingAccumulator) => void;
/**
 * Resolve pre-extracted Laravel routes to CALLS edges from route files to controller methods.
 */
export declare const processRoutesFromExtracted: (graph: KnowledgeGraph, extractedRoutes: ExtractedRoute[], ctx: ResolutionContext, onProgress?: (current: number, total: number) => void) => Promise<void>;
export declare const extractConsumerAccessedKeys: (content: string) => string[];
/**
 * Create FETCHES edges from extracted fetch() calls to matching Route nodes.
 * When consumerContents is provided, extracts property access patterns from
 * consumer files and encodes them in the edge reason field.
 */
export declare const processNextjsFetchRoutes: (graph: KnowledgeGraph, fetchCalls: ExtractedFetchCall[], routeRegistry: Map<string, string>, // routeURL → handlerFilePath
consumerContents?: Map<string, string>) => void;
/**
 * Extract fetch() calls from source files (sequential path).
 * Workers handle this via tree-sitter captures in parse-worker; this function
 * provides the same extraction for the sequential fallback path.
 */
export declare const extractFetchCallsFromFiles: (files: {
    path: string;
    content: string;
}[], astCache: ASTCache) => Promise<ExtractedFetchCall[]>;
export {};
