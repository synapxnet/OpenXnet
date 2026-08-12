/**
 * `REGISTRY_PRIMARY_<LANG>` per-language feature flags for the scope-based
 * resolution rollout (RFC §6.1 Ring 3; Ring 2 PKG #924).
 *
 * This module is the single source of truth for whether a given language
 * has been flipped to registry-primary call resolution. When a language's
 * flag is true, its files route through `Registry.lookup` (RFC §4) instead
 * of the legacy call-resolution DAG; when false (the default), the legacy
 * DAG runs unchanged.
 *
 * ## Contract
 *
 *   - Env-var name per language: `REGISTRY_PRIMARY_<UPPER(enum-value)>`.
 *     Example: `SupportedLanguages.Python` → `REGISTRY_PRIMARY_PYTHON`;
 *     `SupportedLanguages.CPlusPlus` (value `'cpp'`) → `REGISTRY_PRIMARY_CPP`.
 *   - Truthy values: `'true'`, `'1'`, `'yes'` (case-insensitive,
 *     whitespace-trimmed). Anything else — including `undefined`, empty
 *     string, or unknown tokens — is `false`.
 *   - No per-process caching. `process.env` is read on every call. The
 *     flag is consulted once per file at call-resolution time, so the
 *     overhead is negligible; skipping caching keeps test isolation
 *     trivial (no `resetFlagCache()` coordination needed).
 *
 * ## Integration site
 *
 * `call-processor.ts` integration lands in **#921** (`finalize-orchestrator`)
 * where the `SemanticModel` becomes accessible and `Registry.lookup` can
 * actually be called with a populated context. This module ships the flag
 * primitive in isolation so #921 has a clean, tested utility to consult.
 *
 * ## Shadow mode is orthogonal
 *
 * Shadow mode (`GITNEXUS_SHADOW_MODE=1`, introduced in #923) runs BOTH
 * legacy and registry paths regardless of the per-language flag, so the
 * parity dashboard has signal even for un-flipped languages. That logic
 * lives in `shadow-harness.ts` (#923), not here.
 */
import { SupportedLanguages } from 'gitnexus-shared';
/**
 * Return the env-var name that controls a given language's registry-
 * primary flag. Exported for test assertions and for the PR-labeling
 * CI job that cross-references per-language flag changes.
 */
export declare function envVarNameFor(lang: SupportedLanguages): string;
/**
 * Whether `lang` has been flipped to registry-primary call resolution.
 *
 * Returns `false` by default — a language must explicitly set its env
 * var to a truthy value to opt in. The flag is the sole control surface:
 * flipping it requires no code change, and reverting it requires no code
 * change.
 */
export declare function isRegistryPrimary(lang: SupportedLanguages): boolean;
/**
 * All languages whose registry-primary flag is currently on. Useful for
 * startup-time logging + the shadow-harness dashboard, which wants to
 * distinguish "primary: legacy" from "primary: registry" rows.
 */
export declare function primaryLanguages(): ReadonlySet<SupportedLanguages>;
