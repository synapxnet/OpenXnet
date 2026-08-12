import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { bootstrapApplicationArtifacts } from "./application-artifacts";

test("ApplicationArtifactService lazily migrates legacy metadata with stable IDs", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-artifact-migration-"));
  const artifactDirectory = path.join(directory, "uploaded_files");
  const storageName = "5cf0a243-95e6-4abc-a7db-22f55f424f75.md";
  const missingName = "e646504a-dfcb-42b0-bc4b-c783355addb2.png";
  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(path.join(artifactDirectory, storageName), "legacy content", "utf8");
  writeFileSync(
    path.join(directory, "settings.json"),
    JSON.stringify({
      textFiles: [{ unique_filename: storageName, original_filename: "Architecture notes.md" }],
      imageFiles: [{ unique_filename: missingName, original_filename: "Missing image.png" }],
    }),
    "utf8",
  );
  const service = bootstrapApplicationArtifacts({
    userDataDirectory: directory,
    now: () => new Date("2026-07-23T08:00:00.000Z"),
  });
  try {
    const database = new DatabaseSync(path.join(directory, "desktop-core.db"));
    const before = database.prepare("SELECT COUNT(*) AS count FROM application_artifacts").get() as {
      count: number;
    };
    database.close();
    assert.equal(Number(before.count), 0);

    const available = await service.listArtifacts();
    assert.equal(available.artifacts.length, 1);
    assert.equal(available.artifacts[0]?.id, path.parse(storageName).name);
    assert.equal(available.artifacts[0]?.originalName, "Architecture notes.md");
    assert.equal(available.artifacts[0]?.kind, "document");
    assert.equal(available.artifacts[0]?.status, "available");
    assert.equal(available.artifacts[0]?.sha256, null);

    const complete = await service.listArtifacts({ includeUnavailable: true });
    assert.deepEqual(
      complete.artifacts.map((artifact) => [artifact.storageName, artifact.status]).sort(),
      [[missingName, "missing"], [storageName, "available"]].sort(),
    );
  } finally {
    service.close();
  }

  const reopened = bootstrapApplicationArtifacts({ userDataDirectory: directory });
  try {
    const snapshot = await reopened.listArtifacts();
    assert.equal(snapshot.artifacts[0]?.id, path.parse(storageName).name);
    assert.equal(snapshot.artifacts[0]?.originalName, "Architecture notes.md");
  } finally {
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ApplicationArtifactService imports, registers, hashes, and tombstones files", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-artifact-writes-"));
  const sourceDirectory = mkdtempSync(path.join(os.tmpdir(), "openxnet-artifact-source-"));
  const sourcePath = path.join(sourceDirectory, "Project plan.txt");
  const sourceContent = "phase 3e artifact";
  writeFileSync(sourcePath, sourceContent, "utf8");
  const service = bootstrapApplicationArtifacts({
    userDataDirectory: directory,
    now: () => new Date("2026-07-23T09:00:00.000Z"),
  });
  try {
    const imported = await service.importArtifacts({ paths: [sourcePath] });
    const artifact = imported.artifacts[0];
    assert.ok(artifact);
    assert.equal(artifact.originalName, "Project plan.txt");
    assert.equal(artifact.sha256, createHash("sha256").update(sourceContent).digest("hex"));
    assert.equal(
      existsSync(path.join(directory, "uploaded_files", artifact.storageName)),
      true,
    );

    const compatibilityStorageName = "81c948bc-c050-4671-a0ab-c837a3afc720.png";
    const compatibilityPath = path.join(directory, "uploaded_files", compatibilityStorageName);
    writeFileSync(compatibilityPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const registered = await service.registerArtifacts({
      files: [{
        storageName: compatibilityStorageName,
        originalName: "Reference.png",
        kind: "image",
      }],
    });
    assert.equal(registered.artifacts[0]?.id, path.parse(compatibilityStorageName).name);
    assert.equal(registered.artifacts[0]?.originalName, "Reference.png");
    assert.match(registered.artifacts[0]?.sha256 ?? "", /^[0-9a-f]{64}$/);

    const deleted = await service.deleteArtifacts({ artifactIds: [artifact.id] });
    assert.deepEqual(deleted.deletedArtifactIds, [artifact.id]);
    assert.equal(deleted.snapshot.artifacts.some((entry) => entry.id === artifact.id), false);
    assert.equal(existsSync(path.join(directory, "uploaded_files", artifact.storageName)), false);
    assert.equal(existsSync(sourcePath), true);

    const complete = await service.listArtifacts({ includeUnavailable: true });
    const tombstone = complete.artifacts.find((entry) => entry.id === artifact.id);
    assert.equal(tombstone?.status, "deleted");
    assert.equal(tombstone?.deletedAt, "2026-07-23T09:00:00.000Z");
    assert.throws(
      () => service.registerArtifacts({
        files: [{ storageName: "../outside.txt", originalName: "outside.txt" }],
      }),
      /storageName is invalid/,
    );
  } finally {
    service.close();
    rmSync(directory, { recursive: true, force: true });
    rmSync(sourceDirectory, { recursive: true, force: true });
  }
});
