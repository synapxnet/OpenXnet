import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  APPEARANCE_FILE_SYSTEM,
  APPEARANCE_PREFERENCES_CHANNELS,
  MAX_APPEARANCE_PREFERENCES_BYTES,
  registerAppearancePreferencesIpc,
  type AppearanceFileSystem,
  type AppearanceIpcMainLike,
  type AppearancePreferencesResult,
  type AppearanceSyncEvent,
  type AppearanceSyncListener,
  type AppearanceValidationResult,
  type RegisterAppearancePreferencesIpcOptions,
} from "./register-appearance-preferences-ipc";

const skinEngine = require(path.join(__dirname, "../../../static/js/openxnet-skins.js")) as {
  presets(): Record<string, unknown>[];
  createStore(options: { storage: { getItem(): null; setItem(key: string, value: string): void } }): {
    write(value: unknown): { ok: true } | { ok: false; error: string };
  };
};

function validateLibrary(serialized: string): AppearanceValidationResult {
  let normalized = "";
  const result = skinEngine.createStore({ storage: {
    getItem: () => null,
    setItem: (_key, value) => { normalized = value; },
  } }).write(JSON.parse(serialized));
  return result.ok ? { ok: true, value: normalized } : result;
}

function library(name = "我的皮肤"): string {
  return JSON.stringify({ version: 1, selectedId: "custom-test", customSkins: [
    { ...skinEngine.presets()[0], id: "custom-test", name },
  ] });
}

class TestIpcMain implements AppearanceIpcMainLike {
  readonly listeners = new Map<string, Set<AppearanceSyncListener>>();

  on(channel: string, listener: AppearanceSyncListener): void {
    const entries = this.listeners.get(channel) ?? new Set<AppearanceSyncListener>();
    entries.add(listener);
    this.listeners.set(channel, entries);
  }

  removeListener(channel: string, listener: AppearanceSyncListener): void {
    this.listeners.get(channel)?.delete(listener);
  }

  send(channel: string, event: AppearanceSyncEvent, ...arguments_: readonly unknown[]): AppearancePreferencesResult {
    let reply: AppearancePreferencesResult | undefined;
    // Electron通过只写setter发送同步回复，读回并不返回上次赋值。 / Electron sends synchronous replies through a setter; reading it does not return the assigned value.
    Object.defineProperty(event, "returnValue", { configurable: true,
      /** 捕获发送给Renderer的回复，保持原事件属性不可读。 / Capture the Renderer reply while leaving the event property unreadable. */
      set(value: AppearancePreferencesResult) { reply = value; },
    });
    const listeners = this.listeners.get(channel);
    assert.ok(listeners?.size, "Missing IPC listener: " + channel);
    for (const listener of listeners) listener(event, ...arguments_);
    assert.ok(reply);
    return reply;
  }
}

function fixture(t: TestContext, fileSystem: AppearanceFileSystem = APPEARANCE_FILE_SYSTEM) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-appearance-"));
  const appearanceDirectory = path.join(directory, "appearance");
  const destination = path.join(appearanceDirectory, "skins.v1.json");
  const ipcMain = new TestIpcMain();
  const authorizedEvent: AppearanceSyncEvent = {};
  let validations = 0;
  let authorizations = 0;
  const cleanups: (() => void)[] = [];
  function register(overrides: Partial<Pick<RegisterAppearancePreferencesIpcOptions, "authorizeReader" | "onDidChange">> = {}) {
    const cleanup = registerAppearancePreferencesIpc({
      ipcMain, userDataDirectory: directory, fileSystem,
      authorizeEvent: event => {
        authorizations++;
        if (event !== authorizedEvent) throw new Error("Untrusted sender");
      },
      validateSerialized: serialized => { validations++; return validateLibrary(serialized); },
      ...overrides,
    });
    cleanups.push(cleanup);
    return cleanup;
  }
  t.after(() => {
    for (const cleanup of cleanups) cleanup();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("openxnet-appearance-"));
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory, appearanceDirectory, destination, ipcMain, authorizedEvent, register,
    read: (...args: unknown[]) => ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.read, authorizedEvent, ...args),
    write: (...args: unknown[]) => ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.write, authorizedEvent, ...args),
    counts: () => ({ validations, authorizations }),
  };
}

function expectError(result: AppearancePreferencesResult): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.length > 3);
}

test("appearance IPC rejects untrusted senders before reading, validating or writing", t => {
  const subject = fixture(t);
  subject.register();
  expectError(subject.ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.read, {}));
  expectError(subject.ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.write, {}, library()));
  assert.deepEqual(subject.counts(), { validations: 0, authorizations: 2 });
  assert.deepEqual(readdirSync(subject.directory), []);
});

test("appearance IPC accepts only exact argument counts and serialized library data", t => {
  const subject = fixture(t);
  subject.register();
  expectError(subject.read("../../outside.json"));
  expectError(subject.write());
  expectError(subject.write(library(), "../../outside.json"));
  expectError(subject.write({ path: "../../outside.json", value: library() }));
  expectError(subject.write(null));
  assert.equal(subject.counts().validations, 0);
  assert.deepEqual(readdirSync(subject.directory), []);
});

test("a missing library returns null without creating a directory", t => {
  const subject = fixture(t);
  subject.register();
  assert.deepEqual(subject.read(), { ok: true, value: null });
  assert.deepEqual(subject.read(), { ok: true, value: null });
  assert.equal(subject.counts().validations, 0);
  assert.equal(subject.counts().authorizations, 2);
  assert.equal(existsSync(subject.appearanceDirectory), false);
});

test("saved skin library survives a new IPC registration and has one fixed file", t => {
  const subject = fixture(t);
  const cleanup = subject.register();
  const saved = subject.write(library());
  assert.equal(saved.ok, true);
  assert.deepEqual(readdirSync(subject.directory), ["appearance"]);
  assert.deepEqual(readdirSync(subject.appearanceDirectory), ["skins.v1.json"]);
  assert.deepEqual(subject.read(), saved);
  assert.equal(subject.counts().validations, 1, "Successful saves prime the read cache");
  cleanup();
  subject.register();
  assert.deepEqual(subject.read(), saved);
  assert.equal(subject.counts().validations, 2, "A new process adapter validates persisted content");
  if (saved.ok) assert.equal(readFileSync(subject.destination, "utf8"), saved.value);
});

test("invalid JSON, versions and CSS fields leave saved library and cache unchanged", t => {
  const subject = fixture(t);
  subject.register();
  const previous = subject.write(library());
  const bytes = readFileSync(subject.destination, "utf8");
  const unknownField = JSON.parse(library());
  unknownField.customSkins[0].css = "body { display: none }";
  for (const invalid of ["{broken", JSON.stringify({ version: 99, selectedId: "brand-light", customSkins: [] }), JSON.stringify(unknownField)]) {
    expectError(subject.write(invalid));
    assert.equal(readFileSync(subject.destination, "utf8"), bytes);
    assert.deepEqual(subject.read(), previous);
  }
  assert.deepEqual(readdirSync(subject.appearanceDirectory), ["skins.v1.json"]);
});

test("character and UTF-8 byte limits reject oversized requests before validation", t => {
  const subject = fixture(t);
  subject.register();
  expectError(subject.write("a".repeat(MAX_APPEARANCE_PREFERENCES_BYTES + 1)));
  expectError(subject.write("皮".repeat(Math.ceil(MAX_APPEARANCE_PREFERENCES_BYTES / 3))));
  assert.equal(subject.counts().validations, 0);
  assert.deepEqual(readdirSync(subject.directory), []);
});

for (const failure of ["rename", "partial-write"] as const) {
  test(`${failure} failure preserves the previous library and clears its temporary file`, t => {
    let fail = false;
    const fileSystem: AppearanceFileSystem = {
      ...APPEARANCE_FILE_SYSTEM,
      rename: (source, destination) => {
        assert.equal(path.dirname(source), path.dirname(destination));
        if (fail && failure === "rename") throw new Error("Simulated rename failure");
        APPEARANCE_FILE_SYSTEM.rename(source, destination);
      },
      writeExclusive: (file, serialized) => {
        if (fail && failure === "partial-write") {
          writeFileSync(file, serialized.slice(0, 12), { flag: "wx" });
          throw new Error("Simulated disk full");
        }
        APPEARANCE_FILE_SYSTEM.writeExclusive(file, serialized);
      },
    };
    const subject = fixture(t, fileSystem);
    subject.register();
    const previous = subject.write(library());
    const bytes = readFileSync(subject.destination, "utf8");
    fail = true;
    expectError(subject.write(library("未保存的修改")));
    assert.equal(readFileSync(subject.destination, "utf8"), bytes);
    assert.deepEqual(subject.read(), previous);
    assert.deepEqual(readdirSync(subject.appearanceDirectory), ["skins.v1.json"]);
  });
}

test("corrupt and oversized files are reported without replacing their original bytes", t => {
  const subject = fixture(t);
  mkdirSync(subject.appearanceDirectory);
  for (const bytes of ["{damaged", "a".repeat(MAX_APPEARANCE_PREFERENCES_BYTES + 1)]) {
    writeFileSync(subject.destination, bytes);
    const cleanup = subject.register();
    expectError(subject.write(library()));
    expectError(subject.read());
    assert.equal(readFileSync(subject.destination, "utf8"), bytes);
    assert.deepEqual(readdirSync(subject.appearanceDirectory), ["skins.v1.json"]);
    cleanup();
  }
});

test("cleanup removes only the registered appearance listeners", t => {
  const subject = fixture(t);
  const unrelated: AppearanceSyncListener = () => {};
  subject.ipcMain.on(APPEARANCE_PREFERENCES_CHANNELS.read, unrelated);
  const cleanup = subject.register();
  assert.equal(subject.ipcMain.listeners.get(APPEARANCE_PREFERENCES_CHANNELS.read)?.size, 2);
  cleanup();
  cleanup();
  assert.deepEqual([...subject.ipcMain.listeners.get(APPEARANCE_PREFERENCES_CHANNELS.read) ?? []], [unrelated]);
  assert.equal(subject.ipcMain.listeners.get(APPEARANCE_PREFERENCES_CHANNELS.write)?.size, 0);
});

/** 浮窗只读授权不扩大写入权限，保存失败和读取不能广播变更。 / Companion read authorization never widens write access, and failed saves or reads cannot broadcast changes. */
test("appearance companion readers cannot write and only successful main saves announce changes", t => {
  const subject = fixture(t); const companionEvent: AppearanceSyncEvent = {}; let changes = 0;
  subject.register({
    /** 仅允许明确主窗和伴随窗口身份读取。 / Permit reads only for explicit main and companion identities. */
    authorizeReader(event) { if (event !== subject.authorizedEvent && event !== companionEvent) throw new Error("Untrusted reader"); },
    /** 记录成功保存通知。 / Record successful-save notifications. */
    onDidChange() { changes += 1; },
  });
  assert.deepEqual(subject.ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.read, companionEvent), { ok: true, value: null });
  expectError(subject.ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.write, companionEvent, library()));
  expectError(subject.ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.read, {}));
  assert.equal(changes, 0); assert.equal(existsSync(subject.appearanceDirectory), false);
  const saved = subject.write(library()); assert.equal(saved.ok, true); assert.equal(changes, 1);
  assert.deepEqual(subject.ipcMain.send(APPEARANCE_PREFERENCES_CHANNELS.read, companionEvent), saved); assert.equal(changes, 1);
  expectError(subject.write("invalid-library")); assert.equal(changes, 1);
});

/** 原生只写回复属性不能被回读；伴随广播错误不能破坏成功保存的同步回复。 / Native write-only reply properties must not be read back, and companion errors cannot invalidate successful synchronous saves. */
test("setter-only Electron replies survive consecutive theme switches and failed companion broadcasts", t => {
  const subject = fixture(t); let broadcasts = 0;
  subject.register({
    /** 模拟已关闭伴随窗口抛错。 / Simulate an error from a closed companion. */
    onDidChange() { broadcasts += 1; throw new Error("Companion closed"); },
  });
  for (const selectedId of ["brand-dark", "brand-light", "brand-dark"]) {
    const saved = subject.write(JSON.stringify({ version: 1, selectedId, customSkins: [] }));
    assert.equal(saved.ok, true); assert.equal(subject.authorizedEvent.returnValue, undefined);
    assert.deepEqual(subject.read(), saved);
    assert.equal(JSON.parse(readFileSync(subject.destination, "utf8")).selectedId, selectedId);
  }
  assert.equal(broadcasts, 3);
  expectError(subject.write("{invalid")); assert.equal(broadcasts, 3);
});
