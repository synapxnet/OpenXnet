"use strict";

const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ENTRY_SCHEMA = "openxnet.feature-pack.catalog-entry.v1";
const CATALOG_SCHEMA = "openxnet.feature-pack.catalog.v1";

/**
 * Expand catalog-entry files and directories in deterministic order.
 *
 * @param {string[]} inputs Input descriptor files or directories.
 * @returns {Promise<string[]>} Absolute descriptor paths.
 */
async function resolveDescriptorPaths(inputs) {
  const files = [];
  for (const input of inputs) {
    const resolved = path.resolve(input);
    const stats = await fs.promises.stat(resolved);
    if (stats.isDirectory()) {
      const names = await fs.promises.readdir(resolved);
      files.push(...names
        .filter((name) => name.endsWith(".catalog-entry.json"))
        .map((name) => path.join(resolved, name)));
    } else if (stats.isFile()) {
      files.push(resolved);
    }
  }
  return [...new Set(files)].sort();
}

/**
 * Read validated entries from one package descriptor.
 *
 * @param {string} descriptorPath Catalog-entry descriptor path.
 * @returns {Promise<object[]>} Parsed catalog entries.
 */
async function readEntries(descriptorPath) {
  const value = JSON.parse(await fs.promises.readFile(descriptorPath, "utf8"));
  if (value?.schema !== ENTRY_SCHEMA || !Array.isArray(value.entries) || !value.entries.length) {
    throw new Error(`Invalid Feature Pack catalog descriptor: ${path.basename(descriptorPath)}`);
  }
  return value.entries;
}

/**
 * Atomically write catalog.json as UTF-8.
 *
 * @param {string} destinationPath Final catalog path.
 * @param {object} catalog Serializable catalog.
 * @returns {Promise<void>} Resolves after the catalog is committed.
 */
async function writeCatalog(destinationPath, catalog) {
  const temporaryPath = `${destinationPath}.${randomUUID()}.tmp`;
  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  try {
    await fs.promises.rename(temporaryPath, destinationPath);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true });
  }
}

/**
 * Merge archive descriptors into an unsigned catalog ready for release signing.
 *
 * @returns {Promise<void>} Resolves after catalog.json is written.
 */
async function main() {
  const destinationPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
  const descriptorPaths = await resolveDescriptorPaths(process.argv.slice(3));
  if (!destinationPath || descriptorPaths.length === 0) {
    throw new Error("Usage: npm run build:feature-pack:catalog -- <catalog.json> <descriptor|directory> [...]");
  }
  const entries = (await Promise.all(descriptorPaths.map(readEntries))).flat();
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry?.id}:${entry?.version}:${entry?.platform}:${entry?.architecture}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate Feature Pack catalog entry: ${key}`);
    }
    seen.add(key);
  }
  entries.sort((left, right) => (
    String(left.id).localeCompare(String(right.id))
    || String(left.platform).localeCompare(String(right.platform))
    || String(left.architecture).localeCompare(String(right.architecture))
    || String(left.version).localeCompare(String(right.version), "en", { numeric: true })
  ));
  const generatedAt = String(process.env.OPENXNET_FEATURE_PACK_CATALOG_GENERATED_AT || "").trim()
    || new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("OPENXNET_FEATURE_PACK_CATALOG_GENERATED_AT must be an ISO-8601 timestamp.");
  }
  await writeCatalog(destinationPath, { schema: CATALOG_SCHEMA, generatedAt, entries });
  process.stdout.write(`Created ${path.basename(destinationPath)} with ${entries.length} entries.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
