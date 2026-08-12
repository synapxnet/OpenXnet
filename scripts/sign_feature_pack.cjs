"use strict";

const { createPrivateKey, randomUUID, sign } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SIGNATURE_SCHEMA = "openxnet.feature-pack.signature.v1";

/**
 * Read the Ed25519 private key exclusively from the release environment.
 *
 * @returns {string} PEM-encoded private key.
 */
function readSigningKey() {
  const keyFile = String(process.env.OPENXNET_FEATURE_PACK_SIGNING_KEY_FILE || "").trim();
  const inlineKey = String(process.env.OPENXNET_FEATURE_PACK_SIGNING_KEY_PEM || "").trim();
  if (keyFile && inlineKey) {
    throw new Error("Configure only one Feature Pack signing key source.");
  }
  if (keyFile) {
    return fs.readFileSync(path.resolve(keyFile), "utf8");
  }
  if (inlineKey) {
    return inlineKey.replace(/\\n/g, "\n");
  }
  throw new Error(
    "OPENXNET_FEATURE_PACK_SIGNING_KEY_FILE or OPENXNET_FEATURE_PACK_SIGNING_KEY_PEM is required.",
  );
}

/**
 * Resolve manifest.json or catalog.json and its detached signature destination.
 *
 * @param {string} inputPath User-supplied JSON file or Feature Pack directory.
 * @returns {{payloadPath: string, signaturePath: string}} Absolute signing paths.
 */
function resolveSigningPaths(inputPath) {
  const resolved = path.resolve(inputPath);
  const stat = fs.statSync(resolved);
  const payloadPath = stat.isDirectory() ? path.join(resolved, "manifest.json") : resolved;
  const basename = path.basename(payloadPath);
  if (basename !== "manifest.json" && basename !== "catalog.json") {
    throw new Error("Only manifest.json and catalog.json may be signed by this command.");
  }
  return {
    payloadPath,
    signaturePath: path.join(path.dirname(payloadPath), basename === "manifest.json" ? "manifest.sig" : "catalog.sig"),
  };
}

/**
 * Atomically write a UTF-8 detached signature file.
 *
 * @param {string} destinationPath Final signature path.
 * @param {object} envelope Serializable detached signature envelope.
 * @returns {Promise<void>} Resolves after the atomic rename.
 */
async function writeSignature(destinationPath, envelope) {
  const temporaryPath = `${destinationPath}.${randomUUID()}.tmp`;
  await fs.promises.writeFile(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  try {
    await fs.promises.rename(temporaryPath, destinationPath);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true });
  }
}

/**
 * Sign exact JSON bytes with the release Ed25519 key.
 *
 * @returns {Promise<void>} Resolves after the detached signature is written.
 */
async function main() {
  const inputPath = process.argv[2];
  const keyId = String(process.env.OPENXNET_FEATURE_PACK_SIGNING_KEY_ID || "").trim();
  if (!inputPath || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(keyId)) {
    throw new Error(
      "Usage: set OPENXNET_FEATURE_PACK_SIGNING_KEY_ID and run sign:feature-pack -- <pack-directory|catalog.json>.",
    );
  }
  const { payloadPath, signaturePath } = resolveSigningPaths(inputPath);
  const privateKey = createPrivateKey(readSigningKey());
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Feature Pack signing keys must use Ed25519.");
  }
  const payload = await fs.promises.readFile(payloadPath);
  const signature = sign(null, payload, privateKey).toString("base64");
  await writeSignature(signaturePath, {
    schema: SIGNATURE_SCHEMA,
    keyId,
    algorithm: "ed25519",
    signature,
  });
  process.stdout.write(`Signed ${path.basename(payloadPath)} with key '${keyId}'.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
