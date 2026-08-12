import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { APPLICATION_ARTIFACT_CHANNELS } from "../contracts/application-artifacts";
import { bootstrapApplicationArtifacts } from "../storage/application-artifacts";
import type { IpcMainLike } from "./register-core-ipc";
import { registerApplicationArtifactsIpc } from "./register-application-artifacts-ipc";

type Handler = (event: unknown, ...arguments_: readonly unknown[]) => unknown;

class TestIpcMain implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();

  /** Register one test handler by channel. */
  public handle<TArguments extends readonly unknown[], TResult>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => TResult | Promise<TResult>,
  ): void {
    this.handlers.set(channel, listener as Handler);
  }

  /** Remove one test handler by channel. */
  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** Invoke one registered handler through a synthetic Renderer event. */
  public async invoke<TResult>(
    channel: string,
    event: unknown,
    ...arguments_: readonly unknown[]
  ): Promise<TResult> {
    const handler = this.handlers.get(channel);
    assert.ok(handler !== undefined, `Missing IPC handler for ${channel}`);
    return await handler(event, ...arguments_) as TResult;
  }
}

test("registerApplicationArtifactsIpc authorizes senders and native import paths", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-artifact-ipc-"));
  const sourcePath = path.join(directory, "IPC source.md");
  writeFileSync(sourcePath, "authorized", "utf8");
  const ipcMain = new TestIpcMain();
  const artifacts = bootstrapApplicationArtifacts({
    userDataDirectory: path.join(directory, "user-data"),
  });
  const authorizedEvent = { authorized: true };
  const cleanup = registerApplicationArtifactsIpc({
    ipcMain,
    artifacts,
    authorizeEvent: (event) => {
      if (event !== authorizedEvent) {
        throw new Error("IPC sender is not authorized.");
      }
    },
    authorizeImportPath: (_event, filePath) => {
      if (path.resolve(filePath) !== path.resolve(sourcePath)) {
        throw new Error("Artifact source path is not authorized.");
      }
    },
  });
  try {
    const imported = await ipcMain.invoke<{ artifacts: readonly { originalName: string }[] }>(
      APPLICATION_ARTIFACT_CHANNELS.importFiles,
      authorizedEvent,
      { paths: [sourcePath] },
    );
    assert.equal(imported.artifacts[0]?.originalName, "IPC source.md");
    const rendererImported = await ipcMain.invoke<{ artifacts: readonly { originalName: string }[] }>(
      APPLICATION_ARTIFACT_CHANNELS.importRendererFiles,
      authorizedEvent,
      {
        entries: [{
          source: "bytes",
          originalName: "Clipboard note.txt",
          bytes: new TextEncoder().encode("inline"),
        }],
      },
    );
    assert.equal(rendererImported.artifacts[0]?.originalName, "Clipboard note.txt");
    const listed = await ipcMain.invoke<{ artifacts: readonly unknown[] }>(
      APPLICATION_ARTIFACT_CHANNELS.list,
      authorizedEvent,
      {},
    );
    assert.equal(listed.artifacts.length, 2);
    await assert.rejects(
      ipcMain.invoke(APPLICATION_ARTIFACT_CHANNELS.list, {}, {}),
      /IPC sender is not authorized/,
    );
    await assert.rejects(
      ipcMain.invoke(
        APPLICATION_ARTIFACT_CHANNELS.importFiles,
        authorizedEvent,
        { paths: [path.join(directory, "unauthorized.md")] },
      ),
      /source path is not authorized/,
    );
    await assert.rejects(
      ipcMain.invoke(
        APPLICATION_ARTIFACT_CHANNELS.importRendererFiles,
        authorizedEvent,
        {
          entries: [{ source: "bytes", originalName: "empty.txt", bytes: new Uint8Array() }],
        },
      ),
      /byte budget/,
    );
  } finally {
    cleanup();
    artifacts.close();
    rmSync(directory, { recursive: true, force: true });
  }
  assert.equal(ipcMain.handlers.size, 0);
});
