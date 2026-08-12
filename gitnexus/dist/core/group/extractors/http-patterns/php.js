import PHP from 'tree-sitter-php';
import { compilePatterns, runCompiledPatterns, unquoteLiteral, } from '../tree-sitter-scanner.js';
/**
 * PHP HTTP plugin — Laravel `Route::get/post/...` declarations.
 *
 * The pipeline already uses `PHP.php_only` for ingesting plain `.php`
 * files (see `core/tree-sitter/parser-loader.ts`), and we do the same
 * here so Laravel route files are parsed with the right grammar dialect.
 */
const LARAVEL_PATTERNS = compilePatterns({
    name: 'php-laravel',
    language: PHP.php_only,
    patterns: [
        {
            meta: {},
            query: `
        (scoped_call_expression
          scope: (name) @scope (#eq? @scope "Route")
          name: (name) @method (#match? @method "^(get|post|put|delete|patch)$")
          arguments: (arguments . (argument (string) @path)))
      `,
        },
    ],
});
/**
 * Extract the inner text of a PHP `string` node. The tree-sitter-php
 * grammar wraps single / double-quoted literals differently depending
 * on content; we try both the raw `text` (with quotes) through
 * `unquoteLiteral`, and a fallback via the `string_value` / `string_content`
 * child nodes.
 */
function phpStringText(node) {
    // Most single-quoted strings expose their inner content through the
    // full node text (including quotes), which unquoteLiteral strips.
    const direct = unquoteLiteral(node.text);
    if (direct !== null && direct !== node.text)
        return direct;
    // Fall back to child string_content / string_value node if present.
    for (const child of node.children) {
        if (child.type === 'string_content' || child.type === 'string_value') {
            return child.text;
        }
    }
    return direct;
}
export const PHP_HTTP_PLUGIN = {
    name: 'php-http',
    language: PHP.php_only,
    scan(tree) {
        const out = [];
        for (const match of runCompiledPatterns(LARAVEL_PATTERNS, tree)) {
            const methodNode = match.captures.method;
            const pathNode = match.captures.path;
            if (!methodNode || !pathNode)
                continue;
            const path = phpStringText(pathNode);
            if (path === null)
                continue;
            out.push({
                role: 'provider',
                framework: 'laravel',
                method: methodNode.text.toUpperCase(),
                path,
                name: 'route',
                confidence: 0.8,
            });
        }
        return out;
    },
};
