/**
 * Scope-resolution type definitions — RFC §2 data model (authoritative source).
 *
 * See: https://www.notion.so/346dc50b6ed281cfaacbe480bf231d50
 *
 * Anti-drift rule: every type, interface, and enum defined here is the single
 * source of truth. Later code that references these names must import them
 * from `gitnexus-shared`; it must not re-define them locally.
 *
 * Lifecycle contract (RFC §2.8): scopes are **constructed during extraction,
 * linked during finalize, immutable after finalize**. All fields are
 * `readonly` at the type level; `Object.freeze` is applied at runtime in dev
 * builds. `ReferenceIndex` is the sole structure populated after freeze — by
 * resolution, before emission.
 */
export {};
//# sourceMappingURL=types.js.map