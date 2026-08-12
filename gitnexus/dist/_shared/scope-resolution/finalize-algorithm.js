/**
 * `finalize` — cross-file finalize algorithm for the SemanticModel
 * (RFC §3.2 Phase 2; Ring 2 SHARED #915).
 *
 * Pure logic that takes per-file parse output (`ParsedImport[]` +
 * `SymbolDefinition[]`) and returns:
 *
 *   - Linked `ImportEdge[]` per module scope, with `targetModuleScope` and
 *     `targetDefId` filled where resolvable; edges that could not be
 *     resolved within the hard fixpoint cap are marked
 *     `linkStatus: 'unresolved'`.
 *   - Materialized `bindings` per module scope — local defs merged with
 *     imported / wildcard-expanded / re-exported names via the provider's
 *     `mergeBindings` precedence.
 *   - The SCC condensation of the import graph, exposed so disjoint SCCs
 *     can be processed in parallel by callers that want that.
 *
 * The algorithm is **SCC-aware**: it runs Tarjan SCC over the file-level
 * import graph, processes SCCs in reverse-topological order (leaves
 * first), and within each SCC runs a bounded fixpoint link pass capped at
 * `N = |edges in SCC|`. Cyclic imports finalize without hanging; malformed
 * inputs are bounded by the cap.
 *
 * **No language-specific logic.** Target resolution, wildcard expansion,
 * and binding precedence all go through caller-supplied hooks
 * (`resolveImportTarget`, `expandsWildcardTo`, `mergeBindings`) that
 * match the LanguageProvider surface from #911.
 *
 * **Dynamic imports rule.** `kind === 'dynamic-unresolved'` passes through
 * as an `ImportEdge { kind: 'dynamic-unresolved', targetFile: null }`
 * with no `BindingRef`. They are parse-time signals, not linkable targets.
 */
// ─── Entry point ───────────────────────────────────────────────────────────
export function finalize(input, hooks) {
    const byFilePath = new Map();
    for (const f of input.files)
        byFilePath.set(f.filePath, f);
    // ── Phase 0: pre-resolve raw import targets (one syscall-equivalent per
    // (file, parsedImport)). Edges with no resolvable target become
    // `linkStatus: 'unresolved'` or, for dynamic-unresolved, pass through
    // with `targetFile: null`.
    const edgeIndex = new Map(); // filePath → drafts
    let totalEdges = 0;
    for (const file of input.files) {
        const drafts = [];
        for (const parsed of file.parsedImports) {
            const draft = makeEdgeDraft(parsed, file, hooks, input.workspaceIndex);
            drafts.push(draft);
            totalEdges++;
        }
        edgeIndex.set(file.filePath, drafts);
    }
    // ── Phase 1: build file-level import graph (only resolvable edges form
    // graph edges; unresolvable ones are terminal and contribute no
    // fixpoint obligation).
    const graph = new Map();
    for (const file of input.files) {
        graph.set(file.filePath, new Set());
    }
    for (const [fromFile, drafts] of edgeIndex) {
        const edges = graph.get(fromFile);
        for (const d of drafts) {
            if (d.targetFile !== null && byFilePath.has(d.targetFile)) {
                edges.add(d.targetFile);
            }
        }
    }
    // ── Phase 2: Tarjan SCC → reverse-topological list of SCCs.
    const sccs = tarjanSccs(graph);
    // ── Phase 3: process SCCs in reverse-topological order (leaves first).
    // Within each SCC, run a bounded fixpoint that resolves intra-SCC edges.
    // Edges leaving the SCC are already resolved (their target SCC is
    // already finalized); edges inside the SCC may need multiple passes.
    const linkedByScope = new Map();
    let linkedEdges = 0;
    for (const scc of sccs) {
        const sccFiles = new Set(scc.files);
        const capacity = countEdgesWithin(edgeIndex, sccFiles);
        // Run the fixpoint up to `capacity` iterations. Each iteration tries to
        // resolve every still-unlinked edge in the SCC; stops early if a pass
        // makes no progress.
        let progressed = true;
        let iterations = 0;
        while (progressed && iterations < capacity) {
            progressed = false;
            iterations++;
            for (const filePath of scc.files) {
                const drafts = edgeIndex.get(filePath);
                for (const draft of drafts) {
                    if (draft.finalized !== null)
                        continue;
                    const finalized = tryFinalize(draft, byFilePath);
                    if (finalized !== null) {
                        draft.finalized = finalized;
                        progressed = true;
                    }
                }
            }
        }
        // Any drafts still not finalized within this SCC hit the cap → unresolved.
        for (const filePath of scc.files) {
            const drafts = edgeIndex.get(filePath);
            for (const draft of drafts) {
                if (draft.finalized !== null)
                    continue;
                draft.finalized = {
                    ...draft.base,
                    linkStatus: 'unresolved',
                };
            }
        }
    }
    // ── Phase 4: collect finalized `ImportEdge[]` per module scope, preserving
    // input order within each file, and wildcard-expand where applicable.
    for (const file of input.files) {
        const drafts = edgeIndex.get(file.filePath);
        const finalized = [];
        for (const d of drafts) {
            const edge = d.finalized;
            if (d.source.kind === 'wildcard' && edge.linkStatus !== 'unresolved') {
                // Produce one `wildcard-expanded` ImportEdge per exported name.
                const expanded = expandWildcard(edge, byFilePath, hooks, input.workspaceIndex);
                for (const e of expanded)
                    finalized.push(e);
            }
            else {
                finalized.push(edge);
            }
            if (edge.linkStatus !== 'unresolved')
                linkedEdges++;
        }
        linkedByScope.set(file.moduleScope, Object.freeze(finalized));
    }
    // ── Phase 5: materialize module-scope bindings (local + imports + wildcards),
    // delegating precedence to `provider.mergeBindings`.
    const bindingsByScope = materializeBindings(input.files, linkedByScope, hooks);
    // ── Stats.
    const sccCount = sccs.length;
    let largestSccSize = 0;
    for (const scc of sccs) {
        if (scc.files.length > largestSccSize)
            largestSccSize = scc.files.length;
    }
    const stats = {
        totalFiles: input.files.length,
        totalEdges,
        linkedEdges,
        unresolvedEdges: totalEdges - linkedEdges,
        sccCount,
        largestSccSize,
    };
    return Object.freeze({
        imports: linkedByScope,
        bindings: bindingsByScope,
        sccs,
        stats,
    });
}
function makeEdgeDraft(parsed, file, hooks, workspace) {
    // Dynamic-unresolved passes through — no `BindingRef`, no target file.
    if (parsed.kind === 'dynamic-unresolved') {
        const base = {
            localName: parsed.localName,
            targetFile: null,
            targetExportedName: '',
            kind: 'dynamic-unresolved',
        };
        return {
            source: parsed,
            fromFile: file.filePath,
            fromScope: file.moduleScope,
            targetFile: null,
            base,
            finalized: base, // already fully finalized
        };
    }
    const targetFile = hooks.resolveImportTarget(parsed.targetRaw ?? '', file.filePath, workspace);
    // Edge is unresolvable at the file level — mark unresolved now.
    if (targetFile === null) {
        const edgeKind = parsed.kind === 'wildcard' ? 'wildcard-expanded' : parsed.kind;
        const localName = parsed.kind === 'wildcard' ? '' : parsed.localName;
        const targetExportedName = extractExportedName(parsed);
        const base = {
            localName,
            targetFile: null,
            targetExportedName,
            kind: edgeKind,
            linkStatus: 'unresolved',
        };
        return {
            source: parsed,
            fromFile: file.filePath,
            fromScope: file.moduleScope,
            targetFile: null,
            base,
            finalized: base,
        };
    }
    // Resolvable at the file level; intra-SCC fixpoint may still fail to fill
    // in `targetDefId` (e.g., symbol not exported from target).
    const edgeKind = parsed.kind === 'wildcard' ? 'wildcard-expanded' : parsed.kind;
    const localName = parsed.kind === 'wildcard' ? '' : parsed.localName;
    const targetExportedName = extractExportedName(parsed);
    const base = {
        localName,
        targetFile,
        targetExportedName,
        kind: edgeKind,
    };
    return {
        source: parsed,
        fromFile: file.filePath,
        fromScope: file.moduleScope,
        targetFile,
        base,
        finalized: null,
    };
}
function extractExportedName(parsed) {
    switch (parsed.kind) {
        case 'named':
        case 'alias':
        case 'namespace':
        case 'reexport':
            return parsed.importedName;
        case 'wildcard':
        case 'dynamic-unresolved':
            return '';
    }
}
// ─── Internal: per-edge finalization (phase 3) ─────────────────────────────
function tryFinalize(draft, byFilePath) {
    const targetFile = draft.targetFile;
    if (targetFile === null)
        return draft.base; // already terminal
    const targetModule = byFilePath.get(targetFile);
    if (targetModule === undefined)
        return draft.base; // external target — leave as-is
    // Wildcards finalize at the file level; their per-name expansion happens
    // in phase 4. At this stage we just record the target module scope.
    if (draft.source.kind === 'wildcard') {
        return {
            ...draft.base,
            targetModuleScope: targetModule.moduleScope,
        };
    }
    // Namespace imports alias the target *module*; they don't name a
    // specific export. Link the module scope unconditionally. If the target
    // also exposes a def whose simple name matches `importedName` (some
    // languages emit a synthetic module-def), pick it up as the `targetDefId`
    // so consumers can reach the module as a symbol — but its absence is not
    // a failure.
    if (draft.source.kind === 'namespace') {
        const moduleDef = findExportByName(targetModule.localDefs, extractExportedName(draft.source));
        return {
            ...draft.base,
            targetModuleScope: targetModule.moduleScope,
            ...(moduleDef !== undefined ? { targetDefId: moduleDef.nodeId } : {}),
        };
    }
    // named / alias / reexport: look up the imported name in the target's
    // local defs. Multi-hop re-export chains settle iteratively — each hop
    // resolves once its prior hop is finalized.
    const importedName = extractExportedName(draft.source);
    const exported = findExportByName(targetModule.localDefs, importedName);
    if (exported === undefined) {
        // Target resolvable but the name isn't exported — keep trying in case a
        // re-export inside the target's SCC surfaces it in a later iteration.
        return null;
    }
    const transitiveVia = draft.source.kind === 'reexport' ? Object.freeze([targetFile]) : undefined;
    return {
        ...draft.base,
        targetModuleScope: targetModule.moduleScope,
        targetDefId: exported.nodeId,
        ...(transitiveVia !== undefined ? { transitiveVia } : {}),
    };
}
/**
 * The "simple" (unqualified) name of a def, for import-name matching.
 *
 * Canonical source: `def.qualifiedName` — the tail after the last `.` (or
 * the whole string if no dot). Defs without a qualifiedName can't be
 * resolved by name here and return `null`; callers treat that as "name
 * not exported" and either retry in a later fixpoint iteration or mark
 * the edge unresolved.
 */
function deriveSimpleName(def) {
    const q = def.qualifiedName;
    if (q === undefined || q.length === 0)
        return null;
    const dot = q.lastIndexOf('.');
    return dot === -1 ? q : q.slice(dot + 1);
}
function findExportByName(defs, name) {
    for (const d of defs) {
        if (deriveSimpleName(d) === name)
            return d;
    }
    return undefined;
}
function countEdgesWithin(edgeIndex, files) {
    let n = 0;
    for (const filePath of files) {
        const drafts = edgeIndex.get(filePath);
        if (drafts === undefined)
            continue;
        for (const d of drafts) {
            if (d.targetFile !== null && files.has(d.targetFile))
                n++;
        }
    }
    // Guarantee at least one pass even for a trivial SCC (ensures deterministic
    // fixpoint termination even when a single-file SCC has zero intra-SCC edges
    // but still needs one settle pass).
    return Math.max(n, 1);
}
// ─── Internal: wildcard expansion (phase 4) ────────────────────────────────
function expandWildcard(edge, byFilePath, hooks, workspace) {
    if (edge.targetModuleScope === undefined || edge.targetFile === null) {
        return [edge]; // unresolvable wildcard survives as a single unlinked edge
    }
    const target = byFilePath.get(edge.targetFile);
    if (target === undefined)
        return [edge];
    const names = hooks.expandsWildcardTo(edge.targetModuleScope, workspace);
    if (names.length === 0)
        return [];
    const expanded = [];
    for (const name of names) {
        const def = findExportByName(target.localDefs, name);
        if (def === undefined)
            continue;
        expanded.push({
            localName: name,
            targetFile: edge.targetFile,
            targetExportedName: name,
            kind: 'wildcard-expanded',
            targetModuleScope: edge.targetModuleScope,
            targetDefId: def.nodeId,
        });
    }
    return expanded;
}
// ─── Internal: bindings materialization (phase 5) ───────────────────────────
function materializeBindings(files, linkedByScope, hooks) {
    const out = new Map();
    for (const file of files) {
        const scopeBindings = new Map();
        // Start with local defs as `origin: 'local'` bindings.
        for (const def of file.localDefs) {
            const name = deriveSimpleName(def);
            if (name === null)
                continue;
            const incoming = [{ def, origin: 'local' }];
            const existing = scopeBindings.get(name) ?? [];
            scopeBindings.set(name, hooks.mergeBindings(existing, incoming, file.moduleScope));
        }
        // Layer in finalized imports.
        const imports = linkedByScope.get(file.moduleScope) ?? [];
        for (const edge of imports) {
            if (edge.targetDefId === undefined || edge.linkStatus === 'unresolved')
                continue;
            // Every def the importing file needs to reach is in some other file's
            // `localDefs`; walk all files to find it. In practice we could index
            // this, but at finalize-time N(files) is small per workspace pass.
            const def = findDefById(files, edge.targetDefId);
            if (def === undefined)
                continue;
            const origin = edge.kind === 'namespace'
                ? 'namespace'
                : edge.kind === 'wildcard-expanded'
                    ? 'wildcard'
                    : edge.kind === 'reexport'
                        ? 'reexport'
                        : 'import';
            const fallback = deriveSimpleName(def);
            const name = edge.localName.length > 0 ? edge.localName : fallback;
            if (name === null)
                continue;
            const incoming = [{ def, origin, via: edge }];
            const existing = scopeBindings.get(name) ?? [];
            scopeBindings.set(name, hooks.mergeBindings(existing, incoming, file.moduleScope));
        }
        // Freeze nested buckets for immutability.
        const frozen = new Map();
        for (const [name, refs] of scopeBindings) {
            frozen.set(name, Object.freeze(refs.slice()));
        }
        out.set(file.moduleScope, frozen);
    }
    return out;
}
function findDefById(files, defId) {
    for (const f of files) {
        for (const d of f.localDefs) {
            if (d.nodeId === defId)
                return d;
        }
    }
    return undefined;
}
// ─── Internal: Tarjan SCC ──────────────────────────────────────────────────
/**
 * Iterative Tarjan SCC. Returns SCCs in **reverse-topological** order
 * (leaves first — a property Tarjan gives for free, and the order
 * `finalize` wants so leaves are fully resolved before their dependents).
 */
function tarjanSccs(graph) {
    const index = new Map();
    const lowlink = new Map();
    const onStack = new Set();
    const stack = [];
    const sccs = [];
    let idx = 0;
    // Iterative DFS to avoid stack overflow on deep import chains.
    const allNodes = Array.from(graph.keys()).sort(); // deterministic order
    const iterStack = [];
    for (const root of allNodes) {
        if (index.has(root))
            continue;
        iterStack.push({
            node: root,
            children: (graph.get(root) ?? new Set()).values(),
            entered: false,
        });
        while (iterStack.length > 0) {
            const frame = iterStack[iterStack.length - 1];
            if (!frame.entered) {
                frame.entered = true;
                index.set(frame.node, idx);
                lowlink.set(frame.node, idx);
                idx++;
                stack.push(frame.node);
                onStack.add(frame.node);
            }
            const nextChild = frame.children.next();
            if (nextChild.done) {
                // Post-visit: compute SCC membership if frame.node is a root.
                if (lowlink.get(frame.node) === index.get(frame.node)) {
                    const scc = [];
                    let selfInCycle = false;
                    while (true) {
                        const w = stack.pop();
                        onStack.delete(w);
                        scc.push(w);
                        // A single-file self-loop counts as a cycle.
                        if (w === frame.node) {
                            selfInCycle = (graph.get(w) ?? new Set()).has(w);
                            break;
                        }
                    }
                    const isCycle = scc.length > 1 || selfInCycle;
                    sccs.push({ files: Object.freeze(scc), isCycle });
                }
                iterStack.pop();
                // Propagate lowlink to parent.
                if (iterStack.length > 0) {
                    const parent = iterStack[iterStack.length - 1];
                    lowlink.set(parent.node, Math.min(lowlink.get(parent.node), lowlink.get(frame.node)));
                }
                continue;
            }
            const child = nextChild.value;
            if (!index.has(child)) {
                iterStack.push({
                    node: child,
                    children: (graph.get(child) ?? new Set()).values(),
                    entered: false,
                });
            }
            else if (onStack.has(child)) {
                lowlink.set(frame.node, Math.min(lowlink.get(frame.node), index.get(child)));
            }
        }
    }
    return sccs;
}
//# sourceMappingURL=finalize-algorithm.js.map