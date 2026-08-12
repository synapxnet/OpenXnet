"use strict";

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const manifestSchema = "openxnet.feature-pack.v1";

/**
 * Parse supported command-line options for the standalone pack builder.
 *
 * @param {string[]} argumentsList Arguments after the Node executable and script path.
 * @returns {{sourceDirectory: string, outputDirectory: string | null}} Normalized build options.
 */
function parseArguments(argumentsList) {
  let sourceDirectory = path.join(projectRoot, "gitnexus");
  let outputDirectory = null;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--source") {
      sourceDirectory = path.resolve(argumentsList[index + 1] || "");
      index += 1;
    } else if (argument === "--output") {
      outputDirectory = path.resolve(argumentsList[index + 1] || "");
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { sourceDirectory, outputDirectory };
}

/**
 * Read and parse one UTF-8 JSON file.
 *
 * @param {string} filePath Absolute JSON file path.
 * @returns {Record<string, any>} Parsed object.
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Convert an absolute child path into a stable POSIX path.
 *
 * @param {string} root Owning root directory.
 * @param {string} child Absolute child path.
 * @returns {string} Relative path with forward slashes.
 */
function toPosixRelative(root, child) {
  return path.relative(root, child).split(path.sep).join("/");
}

/**
 * Return a shell-independent npm CLI invocation for the current workspace.
 *
 * @returns {{command: string, arguments: string[]}} Executable and leading CLI arguments.
 */
function getNpmInvocation() {
  const npmCli = process.env.npm_execpath
    || path.join(projectRoot, "node_modules", "npm", "bin", "npm-cli.js");
  return { command: process.execPath, arguments: [npmCli] };
}

/**
 * Ask npm for the installed production dependency closure without network access.
 *
 * @param {string} sourceDirectory GitNexus package root.
 * @returns {string[]} Absolute installed package directories in dependency order.
 */
function listProductionPackages(sourceDirectory) {
  const npm = getNpmInvocation();
  const output = execFileSync(
    npm.command,
    [...npm.arguments, "ls", "--omit=dev", "--all", "--parseable"],
    { cwd: sourceDirectory, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const nodeModulesRoot = path.join(sourceDirectory, "node_modules");
  const normalizedRoot = `${path.resolve(nodeModulesRoot)}${path.sep}`;
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "" && path.resolve(line) !== path.resolve(sourceDirectory))
    .map((line) => path.resolve(line))
    .filter((packageDirectory) => packageDirectory.startsWith(normalizedRoot))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Determine whether a copy candidate belongs to a package's nested dependency tree.
 *
 * @param {string} packageDirectory Package root currently being copied.
 * @param {string} candidatePath Candidate file or directory.
 * @returns {boolean} True when the entry is package-owned runtime content.
 */
function shouldCopyPackageEntry(packageDirectory, candidatePath) {
  const relativePath = path.relative(packageDirectory, candidatePath);
  if (relativePath === "") {
    return true;
  }
  return !relativePath.split(path.sep).includes("node_modules");
}

/**
 * Copy each installed production package while preserving npm's nested layout.
 *
 * @param {string} sourceDirectory GitNexus package root.
 * @param {string} outputDirectory Feature-pack root.
 * @returns {Promise<number>} Number of copied production package roots.
 */
async function copyProductionDependencies(sourceDirectory, outputDirectory) {
  const sourceNodeModules = path.join(sourceDirectory, "node_modules");
  const outputNodeModules = path.join(outputDirectory, "node_modules");
  const packageDirectories = listProductionPackages(sourceDirectory);
  for (const packageDirectory of packageDirectories) {
    const relativePath = path.relative(sourceNodeModules, packageDirectory);
    const targetDirectory = path.join(outputNodeModules, relativePath);
    await fsp.mkdir(path.dirname(targetDirectory), { recursive: true });
    await fsp.cp(packageDirectory, targetDirectory, {
      recursive: true,
      force: true,
      dereference: true,
      filter: (candidatePath) => shouldCopyPackageEntry(packageDirectory, candidatePath),
    });
  }
  return packageDirectories.length;
}

/**
 * Determine whether a compiled GitNexus file is needed at runtime.
 *
 * @param {string} candidatePath Candidate path under the dist directory.
 * @returns {boolean} True for runtime JavaScript and assets.
 */
function shouldCopyDistEntry(candidatePath) {
  return !candidatePath.endsWith(".d.ts")
    && !candidatePath.endsWith(".d.ts.map")
    && !candidatePath.endsWith(".js.map");
}

/**
 * Rewrite bare shared-package imports to the private runtime copy in dist/_shared.
 *
 * @param {string} distDirectory Copied GitNexus dist directory.
 * @returns {Promise<number>} Number of JavaScript files changed.
 */
async function rewriteSharedImports(distDirectory) {
  let rewritten = 0;
  const files = await listRegularFiles(distDirectory);
  for (const filePath of files.filter((candidate) => candidate.endsWith(".js"))) {
    const source = await fsp.readFile(filePath, "utf8");
    if (!source.includes("gitnexus-shared")) {
      continue;
    }
    const sharedEntry = path.join(distDirectory, "_shared", "index.js");
    let relativeImport = path.relative(path.dirname(filePath), sharedEntry).split(path.sep).join("/");
    if (!relativeImport.startsWith(".")) {
      relativeImport = `./${relativeImport}`;
    }
    const rewrittenSource = source
      .replace(/from\s+['"]gitnexus-shared['"]/gu, `from '${relativeImport}'`)
      .replace(/import\(\s*['"]gitnexus-shared['"]\s*\)/gu, `import('${relativeImport}')`);
    if (rewrittenSource !== source) {
      await fsp.writeFile(filePath, rewrittenSource, "utf8");
      rewritten += 1;
    }
  }
  return rewritten;
}

/**
 * Copy GitNexus runtime files and inline the shared package used by compiled imports.
 *
 * @param {string} sourceDirectory GitNexus package root.
 * @param {string} outputDirectory Feature-pack root.
 * @returns {Promise<number>} Number of imports rewritten to the private shared copy.
 */
async function copyRuntime(sourceDirectory, outputDirectory) {
  const sourceDist = path.join(sourceDirectory, "dist");
  const outputDist = path.join(outputDirectory, "dist");
  await fsp.cp(sourceDist, outputDist, {
    recursive: true,
    force: true,
    filter: shouldCopyDistEntry,
  });

  const sharedDist = path.join(sourceDirectory, "..", "gitnexus-shared", "dist");
  await fsp.rm(path.join(outputDist, "_shared"), { recursive: true, force: true });
  await fsp.cp(sharedDist, path.join(outputDist, "_shared"), {
    recursive: true,
    force: true,
    filter: shouldCopyDistEntry,
  });
  return rewriteSharedImports(outputDist);
}

/**
 * Recursively list regular files and reject symbolic links in generated output.
 *
 * @param {string} directory Directory to traverse.
 * @returns {Promise<string[]>} Sorted absolute regular-file paths.
 */
async function listRegularFiles(directory) {
  const files = [];
  for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Feature packs cannot contain symbolic links: ${entryPath}`);
    }
    if (entry.isDirectory()) {
      files.push(...await listRegularFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    } else {
      throw new Error(`Unsupported feature-pack entry: ${entryPath}`);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

/**
 * Hash one potentially large file without buffering its full contents.
 *
 * @param {string} filePath Absolute file path.
 * @returns {Promise<string>} Lower-case SHA-256 digest.
 */
async function hashFile(filePath) {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

/**
 * Create deterministic integrity records for every payload file.
 *
 * @param {string} outputDirectory Feature-pack root.
 * @returns {Promise<Array<{path: string, size: number, sha256: string}>>} Manifest file records.
 */
async function createFileRecords(outputDirectory) {
  const files = await listRegularFiles(outputDirectory);
  const records = [];
  for (const filePath of files) {
    if (path.basename(filePath) === "manifest.json" && path.dirname(filePath) === outputDirectory) {
      continue;
    }
    const stats = await fsp.stat(filePath);
    records.push({
      path: toPosixRelative(outputDirectory, filePath),
      size: stats.size,
      sha256: await hashFile(filePath),
    });
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * Copy one optional package metadata file when it exists.
 *
 * @param {string} sourcePath Source metadata path.
 * @param {string} outputDirectory Feature-pack root.
 * @returns {Promise<void>} Completion after the optional copy.
 */
async function copyOptionalMetadata(sourcePath, outputDirectory) {
  try {
    await fsp.copyFile(sourcePath, path.join(outputDirectory, path.basename(sourcePath)));
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Copy a platform Node runtime so the feature pack does not depend on Electron or system Node.
 *
 * Release builders may set OPENXNET_FEATURE_PACK_NODE_RUNTIME to a pinned, signed Node binary.
 *
 * @param {string} outputDirectory Feature-pack root.
 * @returns {Promise<string>} POSIX path to the copied runtime executable.
 */
async function copyNodeRuntime(outputDirectory) {
  const sourceExecutable = path.resolve(
    process.env.OPENXNET_FEATURE_PACK_NODE_RUNTIME || process.execPath,
  );
  const runtimeRelativePath = process.platform === "win32" ? "runtime/node.exe" : "runtime/node";
  const targetExecutable = path.join(outputDirectory, ...runtimeRelativePath.split("/"));
  await fsp.mkdir(path.dirname(targetExecutable), { recursive: true });
  await fsp.copyFile(sourceExecutable, targetExecutable);
  if (process.platform !== "win32") {
    await fsp.chmod(targetExecutable, 0o755);
  }
  return runtimeRelativePath;
}

/**
 * Build a GitNexus runtime pack from local compiled output and production dependencies.
 *
 * @param {{sourceDirectory: string, outputDirectory: string | null}} options Build paths.
 * @returns {Promise<{outputDirectory: string, files: number, bytes: number, packages: number, rewrites: number}>} Build summary.
 */
async function buildFeaturePack(options) {
  const packageJsonPath = path.join(options.sourceDirectory, "package.json");
  const packageJson = readJson(packageJsonPath);
  const desktopPackage = readJson(path.join(projectRoot, "package.json"));
  const packVersion = `${packageJson.version}-openxnet.${desktopPackage.version}`;
  const outputDirectory = options.outputDirectory ?? path.join(
    projectRoot,
    "artifacts",
    "feature-packs",
    "gitnexus",
    `${packVersion}-${process.platform}-${process.arch}`,
  );

  await fsp.rm(outputDirectory, { recursive: true, force: true });
  await fsp.mkdir(outputDirectory, { recursive: true });
  const rewrites = await copyRuntime(options.sourceDirectory, outputDirectory);
  await fsp.copyFile(packageJsonPath, path.join(outputDirectory, "package.json"));
  await copyOptionalMetadata(path.join(options.sourceDirectory, "LICENSE"), outputDirectory);
  const runtimeExecutable = await copyNodeRuntime(outputDirectory);
  const packages = await copyProductionDependencies(options.sourceDirectory, outputDirectory);
  const files = await createFileRecords(outputDirectory);
  const manifest = {
    schema: manifestSchema,
    id: "gitnexus",
    version: packVersion,
    runtime: "node",
    desktopProtocolVersion: "1.0",
    platforms: [process.platform],
    architectures: [process.arch],
    entrypoint: "dist/cli/index.js",
    runtimeExecutable,
    files,
  };
  await fsp.writeFile(
    path.join(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return {
    outputDirectory,
    files: files.length,
    bytes: files.reduce((total, file) => total + file.size, 0),
    packages,
    rewrites,
  };
}

/**
 * Run the command-line builder and report a JSON summary.
 *
 * @returns {Promise<void>} Completion after output and manifest generation.
 */
async function main() {
  const options = parseArguments(process.argv.slice(2));
  const summary = await buildFeaturePack(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
