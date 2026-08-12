"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src", "desktop");

/**
 * Recursively collect TypeScript source files in deterministic order.
 *
 * @param {string} directory Directory to traverse.
 * @returns {string[]} Absolute TypeScript file paths.
 */
function listTypeScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

/**
 * Determine whether an AST node represents a documented function-like declaration.
 *
 * @param {import("typescript").Node} node AST node to classify.
 * @returns {boolean} True for declarations covered by the documentation standard.
 */
function isCheckedDeclaration(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}

/**
 * Return a human-readable declaration name for a diagnostic.
 *
 * @param {import("typescript").Node} node Checked function-like declaration.
 * @returns {string} Declaration name or constructor label.
 */
function declarationName(node) {
  if (ts.isConstructorDeclaration(node)) {
    return "constructor";
  }
  if ("name" in node && node.name) {
    return node.name.getText();
  }
  return "anonymous";
}

/**
 * Determine whether a declaration has an immediately associated JSDoc block.
 *
 * @param {import("typescript").Node} node Checked function-like declaration.
 * @param {import("typescript").SourceFile} sourceFile Owning source file.
 * @returns {boolean} True when a JSDoc block documents the declaration.
 */
function hasJsDoc(node, sourceFile) {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) || [];
  return ranges.some((range) => sourceFile.text.slice(range.pos, range.end).startsWith("/**"));
}

/**
 * Collect documentation diagnostics from one TypeScript source file.
 *
 * @param {string} filePath Absolute source path.
 * @returns {string[]} Human-readable diagnostics.
 */
function checkFile(filePath) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const diagnostics = [];

  /**
   * Visit relevant declarations in the source tree.
   *
   * @param {import("typescript").Node} node Current AST node.
   */
  function visit(node) {
    if (isCheckedDeclaration(node) && !hasJsDoc(node, sourceFile)) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const relativePath = path.relative(projectRoot, filePath);
      diagnostics.push(
        `${relativePath}:${location.line + 1}: function '${declarationName(node)}' requires JSDoc`,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return diagnostics;
}

/**
 * Run TypeScript function documentation checks and set the process exit code.
 */
function main() {
  const diagnostics = listTypeScriptFiles(sourceRoot).flatMap(checkFile);
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      process.stderr.write(`${diagnostic}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write("TypeScript function documentation check passed.\n");
}

main();
