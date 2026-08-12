/**
 * `ScopeExtractor` — the central, source-agnostic driver that turns a
 * language provider's `CaptureMatch[]` into a `ParsedFile`
 * (RFC §5.3 + §3.2 Phase 1; Ring 2 PKG #919).
 *
 * Exactly one entry point: `extract(matches, filePath, provider) → ParsedFile`.
 * Runs a five-pass pipeline over the matches. Each pass is internal; the
 * public contract is the output `ParsedFile`.
 *
 * ## Design principles
 *
 *   - **Source-agnostic.** Consumes `CaptureMatch[]` from providers;
 *     doesn't know whether they came from tree-sitter queries or COBOL's
 *     regex tagger. No `Tree` / `SyntaxNode` types leak into this file.
 *   - **One AST walk per language.** Providers do the AST walk inside
 *     their `emitScopeCaptures` hook; this driver does zero further
 *     traversal — it consumes captures only.
 *   - **Pure-ish.** The extractor itself is pure (same matches →
 *     same ParsedFile) when providers are pure. No side effects, no I/O.
 *   - **Centralized invariant enforcement.** Structural invariants on the
 *     scope tree (non-module has parent; parent contains child; siblings
 *     don't overlap) are enforced by `buildScopeTree` from Ring 2 SHARED
 *     (#912). Malformed inputs throw `ScopeTreeInvariantError`.
 *
 * ## The five passes
 *
 *   1. **Build scope tree.** Walk `@scope.*` matches. For each, consult
 *      `provider.shouldCreateScope` (default true) and
 *      `provider.resolveScopeKind` (default: suffix of the capture name).
 *      Derive parent by lexical-range containment. Hand the resulting
 *      `Scope[]` to `buildScopeTree` for validation.
 *   2. **Attach declarations + local bindings.** Walk `@declaration.*`
 *      matches. For each, build a `SymbolDefinition` and attach it to
 *      `provider.bindingScopeFor` (default: innermost containing scope)
 *      as `ownedDefs` + a local `BindingRef { origin: 'local' }`.
 *   3. **Collect raw imports.** Walk `@import.*` matches. Call
 *      `provider.interpretImport` per match; attach the returned
 *      `ParsedImport` to the ParsedFile (not to any `Scope` — finalize
 *      reconstructs the owning scope via `provider.importOwningScope`
 *      during Phase 2).
 *   4. **Collect type bindings.** Walk `@type-binding.*` matches. Call
 *      `provider.interpretTypeBinding` per match. Attach the resulting
 *      `TypeRef` to the innermost containing scope's `typeBindings`
 *      (or override via `provider.bindingScopeFor` if set).
 *   5. **Collect reference sites.** Walk `@reference.*` matches. Emit
 *      one `ReferenceSite` per match. Classify call form via
 *      `provider.classifyCallForm` (default: the capture's sub-tag if
 *      present; else `'free'`).
 *
 * ## What gets attached where
 *
 *   - `Scope.bindings`     — **local bindings only** at this stage (Pass 2).
 *                            Finalize (#915) merges imports/wildcards on top.
 *   - `Scope.ownedDefs`    — declarations structurally owned by this scope.
 *   - `Scope.typeBindings` — local type facts (parameter annotations, `self`).
 *   - `Scope.imports`      — empty here. Populated by the finalize algorithm
 *                            when it resolves `ParsedImport.targetRaw`.
 *   - `ParsedFile.parsedImports` — every raw import in this file.
 *   - `ParsedFile.localDefs`     — flattened union of `Scope.ownedDefs`.
 *   - `ParsedFile.referenceSites` — pre-resolution usage facts.
 */
import type { CaptureMatch, ParsedFile } from 'gitnexus-shared';
import type { LanguageProvider } from './language-provider.js';
/**
 * The subset of `LanguageProvider` hooks that `extract()` reads. Declared
 * as its own type so:
 *
 *   - Tests can implement just these six hooks without faking the whole
 *     `LanguageProvider` interface (which is ~40 fields including the
 *     legacy-DAG surface).
 *   - The extractor's dependency contract stays explicit — adding a new
 *     hook read requires updating this type.
 *
 * Real callers pass a full `LanguageProvider` — structural typing makes it
 * a `ScopeExtractorHooks` for free.
 */
export type ScopeExtractorHooks = Pick<LanguageProvider, 'shouldCreateScope' | 'resolveScopeKind' | 'bindingScopeFor' | 'interpretImport' | 'interpretTypeBinding' | 'classifyCallForm'>;
/**
 * Drive the five extraction passes and return a `ParsedFile`.
 *
 * Throws `ScopeTreeInvariantError` (from #912) when the provider emits
 * captures that violate structural scope invariants. The error surfaces
 * upward rather than being silently corrected — a malformed capture set
 * is a bug in the provider's `emitScopeCaptures`, not a data condition
 * to tolerate.
 */
export declare function extract(matches: readonly CaptureMatch[], filePath: string, provider: ScopeExtractorHooks): ParsedFile;
