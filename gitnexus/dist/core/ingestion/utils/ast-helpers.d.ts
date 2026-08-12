import type Parser from 'tree-sitter';
import type { NodeLabel } from 'gitnexus-shared';
import type { LanguageProvider } from '../language-provider.js';
/** Tree-sitter AST node. Re-exported for use across ingestion modules. */
export type SyntaxNode = Parser.SyntaxNode;
/**
 * Ordered list of definition capture keys for tree-sitter query matches.
 * Used to extract the definition node from a capture map.
 */
export declare const DEFINITION_CAPTURE_KEYS: readonly ["definition.function", "definition.class", "definition.interface", "definition.method", "definition.struct", "definition.enum", "definition.namespace", "definition.module", "definition.trait", "definition.impl", "definition.type", "definition.const", "definition.static", "definition.variable", "definition.typedef", "definition.macro", "definition.union", "definition.property", "definition.record", "definition.delegate", "definition.annotation", "definition.constructor", "definition.template"];
/** Extract the definition node from a tree-sitter query capture map. */
export declare const getDefinitionNodeFromCaptures: (captureMap: Record<string, SyntaxNode>) => SyntaxNode | null;
/**
 * Node types that represent function/method definitions across languages.
 * Used by parent-walk in call-processor, parse-worker, and type-env to detect
 * enclosing function scope boundaries.
 *
 * INVARIANT: This set MUST be a superset of every language's
 * MethodExtractionConfig.methodNodeTypes. When adding a new node type to a
 * MethodExtractor config, add it here too — otherwise enclosing-function
 * resolution will silently miss that node type during parent-walks.
 */
export declare const FUNCTION_NODE_TYPES: Set<string>;
/**
 * AST node types that represent a class-like container (for HAS_METHOD edge extraction).
 *
 * INVARIANT: When a language config adds a new node type to `typeDeclarationNodes`,
 * that type must also be added here AND to `CONTAINER_TYPE_TO_LABEL` below,
 * otherwise `findEnclosingClassNode` won't recognize it and methods may get
 * orphaned HAS_METHOD edges or incorrect labels.
 */
export declare const CLASS_CONTAINER_TYPES: Set<string>;
export declare const CONTAINER_TYPE_TO_LABEL: Record<string, string>;
/**
 * Determine the graph node label from a tree-sitter capture map.
 * Handles language-specific reclassification via the provider's labelOverride hook
 * (e.g. C/C++ duplicate skipping, Kotlin Method promotion).
 * Returns null if the capture should be skipped (import, call, C/C++ duplicate, missing name).
 */
export declare function getLabelFromCaptures(captureMap: Record<string, SyntaxNode>, provider: LanguageProvider): NodeLabel | null;
/** Enclosing class info: both the generated node ID and the bare class name. */
export interface EnclosingClassInfo {
    classId: string;
    className: string;
}
export declare const findEnclosingClassInfo: (node: SyntaxNode, filePath: string, resolveEnclosingOwner?: (node: SyntaxNode) => SyntaxNode | null) => EnclosingClassInfo | null;
/** Convenience wrapper: returns just the class ID string (backward compat). */
export declare const findEnclosingClassId: (node: SyntaxNode, filePath: string) => string | null;
/**
 * Find a child of `childType` within a sibling node of `siblingType`.
 * Used for Kotlin AST traversal where visibility_modifier lives inside a modifiers sibling.
 */
export declare const findSiblingChild: (parent: SyntaxNode, siblingType: string, childType: string) => SyntaxNode | null;
/** Generic name extraction from a function-like AST node.
 *  Tries `node.childForFieldName('name')?.text`, then scans children for
 *  `identifier` / `property_identifier` / `simple_identifier`. */
export declare const genericFuncName: (node: SyntaxNode) => string | null;
/** AST node types that represent a method definition (for `inferFunctionLabel`). */
export declare const METHOD_LABEL_NODE_TYPES: Set<string>;
/** AST node types that represent a constructor definition (for `inferFunctionLabel`). */
export declare const CONSTRUCTOR_LABEL_NODE_TYPES: Set<string>;
/** Infer node label from AST node type for function-like nodes without a provider hook. */
export declare const inferFunctionLabel: (nodeType: string) => NodeLabel;
/** Argument list node types shared between countCallArguments and call-resolution helpers. */
export declare const CALL_ARGUMENT_LIST_TYPES: Set<string>;
/** Walk an AST node depth-first, returning the first descendant with the given type. */
export declare function findDescendant(root: SyntaxNode, type: string): SyntaxNode | null;
/** Extract the text content from a string or encapsed_string AST node. */
export declare function extractStringContent(node: SyntaxNode | null | undefined): string | null;
/** Find the first direct named child of a tree-sitter node matching the given type. */
export declare function findChild(node: SyntaxNode, type: string): SyntaxNode | null;
