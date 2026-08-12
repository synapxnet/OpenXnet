"use strict";

const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const tar = require("tar");

const ENTRY_SCHEMA = "openxnet.feature-pack.catalog-entry.v1";

/**
 * Determine whether a manifest payload path is safe and canonical.
 *
 * @param {unknown} value Untrusted manifest path.
 * @returns {boolean} True for a POSIX relative payload path.
 */
function isSafePayloadPath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.startsWith("/")) {
    return false;
  }
  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

/**
 * Calculate a streaming SHA-256 digest for one file.
 *
 * @param {string} filePath Absolute file path.
 * @returns {Promise<string>} Lower-case hexadecimal digest.
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
 * Read and minimally validate a signed Feature Pack manifest.
 *
 * @param {string} packDirectory Feature Pack root.
 * @returns {Promise<object>} Parsed manifest.
 */
async function readManifest(packDirectory) {
  const manifestPath = path.join(packDirectory, "manifest.json");
  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
  if (
    manifest?.schema !== "openxnet.feature-pack.v1"
    || typeof manifest.id !== "string"
    || typeof manifest.version !== "string"
    || !Array.isArray(manifest.platforms)
    || !manifest.platforms.length
    || !Array.isArray(manifest.architectures)
    || !manifest.architectures.length
    || !Array.isArray(manifest.files)
    || !manifest.files.length
  ) {
    throw new Error("Feature Pack manifest is incomplete.");
  }
  await fs.promises.access(path.join(packDirectory, "manifest.sig"));
  return manifest;
}

/**
 * Verify every declared payload before adding it to the release archive.
 *
 * @param {string} packDirectory Feature Pack root.
 * @param {object} manifest Parsed Feature Pack manifest.
 * @returns {Promise<string[]>} Deterministic payload path list.
 */
async function verifyPayloads(packDirectory, manifest) {
  const payloadPaths = [];
  const seen = new Set();
  for (const descriptor of manifest.files) {
    if (!isSafePayloadPath(descriptor?.path) || seen.has(descriptor.path)) {
      throw new Error("Feature Pack manifest contains an unsafe or duplicate payload path.");
    }
    seen.add(descriptor.path);
    const payloadPath = path.join(packDirectory, ...descriptor.path.split("/"));
    const stats = await fs.promises.lstat(payloadPath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== descriptor.size) {
      throw new Error(`Feature Pack payload size or type is invalid: ${descriptor.path}`);
    }
    if (await hashFile(payloadPath) !== descriptor.sha256) {
      throw new Error(`Feature Pack payload hash is invalid: ${descriptor.path}`);
    }
    payloadPaths.push(descriptor.path);
  }
  return payloadPaths.sort();
}

/**
 * Atomically write one UTF-8 JSON release descriptor.
 *
 * @param {string} destinationPath Final descriptor path.
 * @param {object} value Serializable descriptor value.
 * @returns {Promise<void>} Resolves after the descriptor is committed.
 */
async function writeJson(destinationPath, value) {
  const temporaryPath = `${destinationPath}.${randomUUID()}.tmp`;
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await fs.promises.rename(temporaryPath, destinationPath);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true });
  }
}

/**
 * Create a safe tar.gz archive and adjacent catalog-entry descriptor.
 *
 * @returns {Promise<void>} Resolves after both release artifacts are written.
 */
async function main() {
  const packDirectory = path.resolve(process.argv[2] || "");
  const archivePath = path.resolve(process.argv[3] || "");
  if (!process.argv[2] || !process.argv[3] || archivePath.startsWith(`${packDirectory}${path.sep}`)) {
    throw new Error("Usage: npm run package:feature-pack -- <signed-pack-directory> <output.tar.gz>");
  }
  const manifest = await readManifest(packDirectory);
  const payloadPaths = await verifyPayloads(packDirectory, manifest);
  await fs.promises.mkdir(path.dirname(archivePath), { recursive: true });
  await tar.create({
    cwd: packDirectory,
    file: archivePath,
    gzip: true,
    portable: true,
    noMtime: true,
  }, ["manifest.json", "manifest.sig", ...payloadPaths]);
  const archiveStats = await fs.promises.stat(archivePath);
  const archiveSha256 = await hashFile(archivePath);
  const archiveUrl = encodeURIComponent(path.basename(archivePath));
  const entries = manifest.platforms.flatMap((platform) => manifest.architectures.map((architecture) => ({
    id: manifest.id,
    version: manifest.version,
    platform,
    architecture,
    archiveUrl,
    archiveSize: archiveStats.size,
    archiveSha256,
  })));
  const descriptorPath = `${archivePath}.catalog-entry.json`;
  await writeJson(descriptorPath, { schema: ENTRY_SCHEMA, entries });
  process.stdout.write(`Created ${path.basename(archivePath)} and ${path.basename(descriptorPath)}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
