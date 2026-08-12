import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGzip } from "node:zlib";

import { create as createTar } from "tar";
import { pack as createTarStream } from "tar-stream";

import type { FeaturePackProgressEvent } from "../contracts/feature-pack-distribution";
import { FEATURE_PACK_MANIFEST_SCHEMA, FeaturePackError } from "./feature-pack";
import {
  assertFeaturePackDistributionUrl,
  FEATURE_PACK_CATALOG_STATE_SCHEMA,
  FEATURE_PACK_CATALOG_SCHEMA,
  FEATURE_PACK_SIGNATURE_SCHEMA,
  FeaturePackDistributionService,
} from "./feature-pack-distribution";
import { FeaturePackManager } from "./feature-pack-manager";

interface FeedFixtureOptions {
  readonly catalogSigner?: "trusted" | "attacker";
  readonly catalogKeyId?: string;
  readonly archiveSha256?: string;
  readonly unsafeArchive?: "traversal" | "symlink";
}

interface FeedFixture {
  readonly root: string;
  readonly manager: FeaturePackManager;
  readonly service: FeaturePackDistributionService;
  readonly close: () => Promise<void>;
}

/**
 * Run one release-side Node script and require a successful exit.
 *
 * @param scriptName Script filename under the repository scripts directory.
 * @param arguments_ Command arguments.
 * @param environment Additional release environment values.
 */
function runReleaseScript(
  scriptName: string,
  arguments_: readonly string[],
  environment: Readonly<NodeJS.ProcessEnv> = {},
): void {
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts", scriptName), ...arguments_],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

/**
 * Build a detached Ed25519 signature envelope for exact payload bytes.
 *
 * @param payload Exact bytes being signed.
 * @param privateKey Ed25519 private key.
 * @param keyId Stable signing key identifier.
 * @returns UTF-8 JSON signature bytes.
 */
function signPayload(payload: Buffer, privateKey: KeyObject, keyId: string): Buffer {
  return Buffer.from(`${JSON.stringify({
    schema: FEATURE_PACK_SIGNATURE_SCHEMA,
    keyId,
    algorithm: "ed25519",
    signature: sign(null, payload, privateKey).toString("base64"),
  }, null, 2)}\n`, "utf8");
}

/**
 * Export an Ed25519 public key as application trust-store PEM.
 *
 * @param publicKey Public key to export.
 * @returns SPKI PEM string.
 */
function exportPublicKey(publicKey: KeyObject): string {
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}

/**
 * Create a valid signed Voice Feature Pack directory.
 *
 * @param root Temporary fixture root.
 * @param privateKey Release signing key.
 * @returns Signed pack directory.
 */
async function createSignedPack(root: string, privateKey: KeyObject): Promise<string> {
  const packDirectory = path.join(root, "source-pack");
  const entrypoint = "worker/main.py";
  const runtimeExecutable = "runtime/python.exe";
  const payload = Buffer.from("print('feature pack')\n", "utf8");
  await fs.mkdir(path.join(packDirectory, "worker"), { recursive: true });
  await fs.mkdir(path.join(packDirectory, "runtime"), { recursive: true });
  await fs.writeFile(path.join(packDirectory, "worker", "main.py"), payload);
  await fs.writeFile(path.join(packDirectory, "runtime", "python.exe"), payload);
  const manifestBytes = Buffer.from(`${JSON.stringify({
    schema: FEATURE_PACK_MANIFEST_SCHEMA,
    id: "voice",
    version: "1.2.3",
    runtime: "python",
    desktopProtocolVersion: "1.0",
    platforms: [process.platform],
    architectures: [process.arch],
    entrypoint,
    runtimeExecutable,
    files: [entrypoint, runtimeExecutable].map((filePath) => ({
      path: filePath,
      size: payload.byteLength,
      sha256: createHash("sha256").update(payload).digest("hex"),
    })),
  }, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(packDirectory, "manifest.json"), manifestBytes);
  await fs.writeFile(path.join(packDirectory, "manifest.sig"), signPayload(manifestBytes, privateKey, "release-key"));
  return packDirectory;
}

/**
 * Create a normal gzip-compressed tar archive from a signed pack.
 *
 * @param packDirectory Signed pack root.
 * @param archivePath Destination archive path.
 */
async function createValidArchive(packDirectory: string, archivePath: string): Promise<void> {
  await createTar({
    cwd: packDirectory,
    file: archivePath,
    gzip: true,
    portable: true,
    noMtime: true,
  }, ["manifest.json", "manifest.sig", "worker", "runtime"]);
}

/**
 * Create a gzip tar containing a traversal path or symbolic link.
 *
 * @param kind Unsafe archive variant.
 * @returns Complete gzip tar bytes.
 */
async function createUnsafeArchive(kind: "traversal" | "symlink"): Promise<Buffer> {
  const archive = createTarStream();
  const gzip = createGzip();
  archive.pipe(gzip);
  const chunks: Buffer[] = [];

  /** Collect each gzip output chunk. */
  const collect = (async (): Promise<Buffer> => {
    for await (const chunk of gzip) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    return Buffer.concat(chunks);
  })();

  if (kind === "traversal") {
    archive.entry({ name: "../escape.txt", type: "file" }, "escape");
  } else {
    archive.entry({ name: "manifest.json", type: "symlink", linkname: "../outside" });
  }
  archive.finalize();
  return collect;
}

/**
 * Start a loopback signed feed and return a configured distribution service.
 *
 * @param options Signature and archive fault injection options.
 * @returns Isolated fixture with cleanup callback.
 */
async function createFeedFixture(options: FeedFixtureOptions = {}): Promise<FeedFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-distribution-"));
  const trustedPair = generateKeyPairSync("ed25519");
  const attackerPair = generateKeyPairSync("ed25519");
  const packDirectory = await createSignedPack(root, trustedPair.privateKey);
  const archivePath = path.join(root, "voice.tar.gz");
  const archiveBytes = options.unsafeArchive === undefined
    ? (await createValidArchive(packDirectory, archivePath), await fs.readFile(archivePath))
    : await createUnsafeArchive(options.unsafeArchive);
  const resources = new Map<string, Buffer>();

  /** Serve immutable fixture resources with explicit byte lengths. */
  const server: Server = createServer((request, response) => {
    const resource = resources.get(request.url ?? "");
    if (resource === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": String(resource.byteLength),
    });
    response.end(resource);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const catalogBytes = Buffer.from(`${JSON.stringify({
    schema: FEATURE_PACK_CATALOG_SCHEMA,
    generatedAt: "2026-07-23T00:00:00.000Z",
    entries: [{
      id: "voice",
      version: "1.2.3",
      platform: process.platform,
      architecture: process.arch,
      archiveUrl: `${origin}/voice.tar.gz`,
      archiveSize: archiveBytes.byteLength,
      archiveSha256: options.archiveSha256
        ?? createHash("sha256").update(archiveBytes).digest("hex"),
    }],
  }, null, 2)}\n`, "utf8");
  const catalogPrivateKey = options.catalogSigner === "attacker"
    ? attackerPair.privateKey
    : trustedPair.privateKey;
  resources.set("/catalog.json", catalogBytes);
  resources.set(
    "/catalog.sig",
    signPayload(catalogBytes, catalogPrivateKey, options.catalogKeyId ?? "release-key"),
  );
  resources.set("/voice.tar.gz", archiveBytes);

  const manager = new FeaturePackManager({ rootDirectory: path.join(root, "installed") });
  const service = new FeaturePackDistributionService({
    manager,
    stagingDirectory: path.join(root, "staging"),
    auditLogPath: path.join(root, "audit", "events.jsonl"),
    feedUrl: `${origin}/catalog.json`,
    trustedKeys: { "release-key": exportPublicKey(trustedPair.publicKey) },
    allowInsecureLoopback: true,
  });

  /** Stop the fixture server and remove all temporary files. */
  async function close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
    await fs.rm(root, { recursive: true, force: true });
  }
  return { root, manager, service, close };
}

test("FeaturePackDistributionService installs, detects damage, repairs, and uninstalls", async () => {
  const fixture = await createFeedFixture();
  const progress: FeaturePackProgressEvent[] = [];
  const unsubscribe = fixture.service.subscribe((event) => progress.push(event));
  try {
    const installed = await fixture.service.install("voice");
    assert.equal(installed.version, "1.2.3");
    assert.equal(installed.restartRequired, true);
    assert.equal((await fixture.service.list(false)).packs[0]?.status, "installed");

    await fs.writeFile(
      path.join(fixture.root, "installed", "voice", "versions", "1.2.3", "worker", "main.py"),
      "corrupted",
      "utf8",
    );
    assert.equal((await fixture.service.list(false)).packs[0]?.status, "damaged");

    await fixture.service.repair("voice");
    assert.equal((await fixture.service.list(false)).packs[0]?.status, "installed");
    await fs.writeFile(
      path.join(fixture.root, "installed", "voice", "current.json"),
      "{invalid pointer",
      "utf8",
    );
    assert.equal((await fixture.service.list(false)).packs[0]?.status, "damaged");
    await fixture.service.repair("voice");
    assert.equal((await fixture.service.list(false)).packs[0]?.status, "installed");
    await fs.writeFile(
      path.join(fixture.root, "installed", "voice", "current.json"),
      "{invalid pointer",
      "utf8",
    );
    await fixture.service.uninstall("voice");
    assert.equal((await fixture.service.list(false)).packs[0]?.status, "not-installed");
    assert.ok(progress.some((event) => event.phase === "downloading"));
    assert.ok(progress.some((event) => event.phase === "completed"));
    const audit = await fs.readFile(path.join(fixture.root, "audit", "events.jsonl"), "utf8");
    assert.equal(audit.trim().split("\n").length, 4);
  } finally {
    unsubscribe();
    await fixture.close();
  }
});

test("FeaturePackDistributionService rejects invalid and unknown catalog signatures", async (context) => {
  await context.test("invalid signature", async () => {
    const fixture = await createFeedFixture({ catalogSigner: "attacker" });
    try {
      await assert.rejects(
        fixture.service.install("voice"),
        (error: unknown) => error instanceof FeaturePackError && error.code === "INVALID_SIGNATURE",
      );
    } finally {
      await fixture.close();
    }
  });

  await context.test("unknown key", async () => {
    const fixture = await createFeedFixture({ catalogKeyId: "unknown-key" });
    try {
      await assert.rejects(
        fixture.service.install("voice"),
        (error: unknown) => error instanceof FeaturePackError && error.code === "UNKNOWN_SIGNING_KEY",
      );
    } finally {
      await fixture.close();
    }
  });
});

test("FeaturePackDistributionService rejects archive hash substitution", async () => {
  const fixture = await createFeedFixture({ archiveSha256: "0".repeat(64) });
  try {
    await assert.rejects(
      fixture.service.install("voice"),
      (error: unknown) => error instanceof FeaturePackError && error.code === "ARCHIVE_HASH_MISMATCH",
    );
  } finally {
    await fixture.close();
  }
});

test("FeaturePackDistributionService blocks replay of an older signed catalog", async () => {
  const fixture = await createFeedFixture();
  try {
    const statePath = path.join(fixture.root, "audit", "feature-pack-catalog-state.json");
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, `${JSON.stringify({
      schema: FEATURE_PACK_CATALOG_STATE_SCHEMA,
      generatedAt: "2026-07-24T00:00:00.000Z",
      sha256: "1".repeat(64),
    }, null, 2)}\n`, "utf8");
    await assert.rejects(
      fixture.service.install("voice"),
      (error: unknown) => error instanceof FeaturePackError && error.code === "ROLLBACK_DETECTED",
    );
  } finally {
    await fixture.close();
  }
});

test("FeaturePackDistributionService rejects traversal and symbolic-link archives", async (context) => {
  for (const unsafeArchive of ["traversal", "symlink"] as const) {
    await context.test(unsafeArchive, async () => {
      const fixture = await createFeedFixture({ unsafeArchive });
      try {
        await assert.rejects(
          fixture.service.install("voice"),
          (error: unknown) => error instanceof FeaturePackError && error.code === "UNSAFE_ARCHIVE",
        );
      } finally {
        await fixture.close();
      }
    });
  }
});

test("Feature Pack URL policy requires HTTPS outside explicit loopback development", () => {
  assert.equal(assertFeaturePackDistributionUrl("https://packages.example.test/catalog.json").protocol, "https:");
  assert.equal(
    assertFeaturePackDistributionUrl("http://127.0.0.1:8000/catalog.json", true).protocol,
    "http:",
  );
  assert.throws(
    () => assertFeaturePackDistributionUrl("http://packages.example.test/catalog.json", true),
    (error: unknown) => error instanceof FeaturePackError && error.code === "DOWNLOAD_FAILED",
  );
  assert.throws(
    () => assertFeaturePackDistributionUrl("https://user:secret@packages.example.test/catalog.json"),
    (error: unknown) => error instanceof FeaturePackError && error.code === "DOWNLOAD_FAILED",
  );
});

test("Feature Pack release scripts sign, package, assemble, and sign a catalog", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openxnet-release-tools-"));
  const keyPair = generateKeyPairSync("ed25519");
  try {
    const packDirectory = await createSignedPack(root, keyPair.privateKey);
    await fs.rm(path.join(packDirectory, "manifest.sig"));
    const signingEnvironment = {
      OPENXNET_FEATURE_PACK_SIGNING_KEY_ID: "release-key",
      OPENXNET_FEATURE_PACK_SIGNING_KEY_PEM: keyPair.privateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString(),
    };
    runReleaseScript("sign_feature_pack.cjs", [packDirectory], signingEnvironment);
    const archivePath = path.join(root, "feed", "voice-1.2.3.tar.gz");
    runReleaseScript("package_feature_pack.cjs", [packDirectory, archivePath]);
    const catalogPath = path.join(root, "feed", "catalog.json");
    runReleaseScript("build_feature_pack_catalog.cjs", [catalogPath, path.dirname(archivePath)], {
      OPENXNET_FEATURE_PACK_CATALOG_GENERATED_AT: "2026-07-23T00:00:00.000Z",
    });
    runReleaseScript("sign_feature_pack.cjs", [catalogPath], signingEnvironment);
    const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8")) as { entries?: unknown[] };
    assert.equal(catalog.entries?.length, 1);
    assert.equal((await fs.stat(archivePath)).isFile(), true);
    assert.equal((await fs.stat(path.join(path.dirname(catalogPath), "catalog.sig"))).isFile(), true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
