/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
会话文件原生边界回归 / Conversation file native boundary regressions.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { IpcMainLike } from "./register-core-ipc";
import { CONVERSATION_FILE_CHANNELS as channels, CONVERSATION_FILE_PREVIEW_BYTES, registerConversationFilesIpc, type ConversationFilePreview, type ConversationFileOptions } from "./register-conversation-files-ipc";

type Handler = (event: unknown, ...args: readonly unknown[]) => unknown;

/** 仅保存真实IPC处理器，不创建Electron窗口。 / Store actual IPC handlers without creating Electron windows. */
class FixtureIpc implements IpcMainLike {
  public readonly handlers = new Map<string, Handler>();
  /** 注册真实测试入口。 / Register an actual test entry. */
  public handle<TArguments extends readonly unknown[], TResult>(channel: string, listener: (event: unknown, ...args: TArguments) => TResult | Promise<TResult>): void { this.handlers.set(channel, listener as Handler); }
  /** 移除测试入口。 / Remove a test entry. */
  public removeHandler(channel: string): void { this.handlers.delete(channel); }
  /** 调用真实处理器并统一同步异常。 / Invoke actual handlers while normalizing synchronous errors. */
  public async invoke<T>(channel: string, request?: unknown, event: unknown = "trusted"): Promise<T> {
    const handler = this.handlers.get(channel); assert.ok(handler);
    return await handler(event, request) as T;
  }
}

/** 创建隔离工作区和本机操作替身；不打开真实文件应用。 / Create isolated workspaces and native-action substitutes without opening real applications. */
async function fixture(overrides: Partial<ConversationFileOptions> = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ox-conversation-files-"));
  const workspace = path.join(root, "workspace"); const outside = path.join(root, "outside");
  await mkdir(workspace); await mkdir(outside);
  const ipc = new FixtureIpc(); const actions: unknown[][] = [];
  const settings = { workspace };
  const picker = { file: null as string | null, save: null as string | null };
  const cleanup = registerConversationFilesIpc({
    ipcMain: ipc,
    /** 校验真实调用方边界。 / Validate the caller boundary. */ authorizeEvent(event) { if (event !== "trusted") throw new Error("untrusted"); },
    /** 模拟Main保存的可切换工作区。 / Model the workspace saved in Main. */ getWorkspacePath() { return settings.workspace; },
    /** 原生选文件仅返回测试选择。 / Native selection returns only a test choice. */ async chooseFile() { return picker.file; },
    /** 保存位置仅由原生对话框替身提供。 / Save targets come only from the dialog substitute. */ async chooseSavePath() { return picker.save; },
    /** 记录默认打开而不启动程序。 / Record default opening without starting a program. */ async openDefault(file) { actions.push(["open", file]); return ""; },
    /** 记录定位而不打开资源管理器。 / Record reveal without opening a file manager. */ reveal(file) { actions.push(["reveal", file]); },
    /** 记录编辑器与独立参数而不执行。 / Record the editor and separate arguments without executing. */ async launchEditor(executable, args) { actions.push(["editor", executable, [...args]]); },
    platform: "win32", environment: {}, ...overrides,
  });
  return { root, workspace, outside, ipc, picker, actions, settings,
    /** 仅删除明确创建的临时测试树。 / Remove only the explicitly created temporary test tree. */ async close() {
      cleanup(); assert.equal(ipc.handlers.size, 0);
      assert.ok(path.dirname(root) === os.tmpdir()); assert.match(path.basename(root), /^ox-conversation-files-/);
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("workspace text preview reports exact bytes hash and literal source", /** 读取真实临时文本且不运行内容。 / Read actual temporary text without executing it. */ async () => {
  const f = await fixture();
  try {
    const text = "<script>neverRun()</script>\n中文🙂\n";
    await writeFile(path.join(f.workspace, "sample.txt"), text);
    const value = await f.ipc.invoke<ConversationFilePreview>(channels.read, { workspacePath: f.workspace, path: "sample.txt" });
    assert.equal(value.content, text); assert.equal(value.source, "workspace"); assert.equal(value.binary, false);
    assert.equal(value.sizeBytes, Buffer.byteLength(text)); assert.equal(value.sha256, createHash("sha256").update(text).digest("hex"));
    assert.equal(value.truncated, false); assert.equal(value.canOpenDefault, true); assert.deepEqual(f.actions, []);
  } finally { await f.close(); }
});

test("workspace mismatch traversal devices streams and directories are rejected", /** 校验各种非授权路径。 / Validate untrusted path variations. */ async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.workspace, "inside.txt"), "inside"); await writeFile(path.join(f.outside, "secret.txt"), "outside");
    for (const request of [
      { path: "../outside/secret.txt" }, { path: path.join(f.outside, "secret.txt") },
      { path: "inside.txt", workspacePath: f.outside }, { path: "." },
      { path: "\\\\.\\PhysicalDrive0" }, { path: "inside.txt:private" }, { path: "NUL" },
      { path: "inside.txt", unexpected: "override" }, { path: "bad\nname" },
    ]) await assert.rejects(f.ipc.invoke(channels.read, request));
    assert.deepEqual(f.actions, []);
  } finally { await f.close(); }
});

test("directory junction escape is rejected while an internal link remains bounded", /** 使用真实目录链接验证规范路径边界。 / Use real directory links to verify canonical containment. */ async () => {
  const f = await fixture();
  try {
    const inside = path.join(f.workspace, "inside"); await mkdir(inside);
    await writeFile(path.join(inside, "safe.txt"), "safe"); await writeFile(path.join(f.outside, "secret.txt"), "secret");
    await symlink(f.outside, path.join(f.workspace, "escape"), "junction");
    await symlink(inside, path.join(f.workspace, "alias"), "junction");
    await assert.rejects(f.ipc.invoke(channels.read, { path: "escape/secret.txt" }), /escapes/);
    const allowed = await f.ipc.invoke<ConversationFilePreview>(channels.read, { path: "alias/safe.txt" });
    assert.equal(allowed.content, "safe"); assert.equal(allowed.path, await realpath(path.join(inside, "safe.txt")));
  } finally { await f.close(); }
});

test("binary and large previews remain bounded and never claim a truncated full hash", /** 验证二进制识别与读取预算。 / Verify binary detection and preview budgets. */ async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.workspace, "binary.txt"), Buffer.from([65, 0, 66]));
    await writeFile(path.join(f.workspace, "large.txt"), "x".repeat(CONVERSATION_FILE_PREVIEW_BYTES + 20));
    await writeFile(path.join(f.workspace, "empty.txt"), "");
    const binary = await f.ipc.invoke<ConversationFilePreview>(channels.read, { path: "binary.txt" });
    assert.equal(binary.binary, true); assert.equal(binary.content, null);
    const large = await f.ipc.invoke<ConversationFilePreview>(channels.read, { path: "large.txt" });
    assert.equal(large.truncated, true); assert.equal(large.content?.length, CONVERSATION_FILE_PREVIEW_BYTES); assert.equal(large.sha256, null);
    const empty = await f.ipc.invoke<ConversationFilePreview>(channels.read, { path: "empty.txt" });
    assert.equal(empty.content, ""); assert.equal(empty.sizeBytes, 0); assert.equal(empty.binary, false);
  } finally { await f.close(); }
});

test("native selection grants only the exact chosen outside file and cancel grants nothing", /** 原生选择不能扩大为目录授权。 / Native selection cannot become directory authorization. */ async () => {
  const f = await fixture();
  try {
    const selected = path.join(f.outside, "selected.txt"); const neighbor = path.join(f.outside, "neighbor.txt");
    await writeFile(selected, "chosen"); await writeFile(neighbor, "not chosen");
    assert.deepEqual(await f.ipc.invoke(channels.select, {}), { canceled: true });
    f.picker.file = selected;
    const preview = await f.ipc.invoke<ConversationFilePreview>(channels.select, { path: "suggested.txt" });
    assert.equal(preview.source, "selected-file"); assert.ok(preview.grantId); assert.equal(preview.content, "chosen");
    assert.equal((await f.ipc.invoke<ConversationFilePreview>(channels.read, { path: preview.path, grantId: preview.grantId })).content, "chosen");
    await assert.rejects(f.ipc.invoke(channels.read, { path: neighbor, grantId: preview.grantId }), /only to the selected file/);
    await assert.rejects(f.ipc.invoke(channels.read, { path: selected, grantId: "invented" }), /expired/);
    await assert.rejects(f.ipc.invoke(channels.read, { path: selected }));
  } finally { await f.close(); }
});

test("open and reveal are explicit while executable and script default opens are denied", /** 不将用户生成的代码当可执行程序打开。 / Never open user-generated code as executable programs. */ async () => {
  const f = await fixture();
  try {
    for (const name of ["safe.txt", "code.py", "launch.cmd", "program.exe", "page.html", "image.svg"]) await writeFile(path.join(f.workspace, name), "content");
    await f.ipc.invoke(channels.act, { path: "safe.txt", action: "open-default" });
    await f.ipc.invoke(channels.act, { path: "code.py", action: "reveal" });
    for (const name of ["code.py", "launch.cmd", "program.exe", "page.html", "image.svg"]) {
      await assert.rejects(f.ipc.invoke(channels.act, { path: name, action: "open-default" }), /editor/);
      assert.equal((await f.ipc.invoke<ConversationFilePreview>(channels.read, { path: name })).canOpenDefault, false);
    }
    assert.deepEqual(f.actions.map(/** 读取已分派动作类型。 / Read dispatched action kinds. */ row => row[0]), ["open", "reveal"]);
  } finally { await f.close(); }
});

test("only installed fixed editors are listed and launch arguments cannot become shell commands", /** 编辑器检测不返回虚构选项，路径不进入shell。 / Editor detection invents no options and paths never enter a shell. */ async () => {
  const installRoot = await mkdtemp(path.join(os.tmpdir(), "ox-editors-"));
  const f = await fixture({ environment: { LOCALAPPDATA: installRoot } });
  try {
    assert.deepEqual(await f.ipc.invoke(channels.editors), []);
    const code = path.join(installRoot, "Programs", "Microsoft VS Code", "Code.exe"); await mkdir(path.dirname(code), { recursive: true }); await writeFile(code, "test executable placeholder");
    assert.deepEqual(await f.ipc.invoke(channels.editors), [{ id: "vscode", label: "Visual Studio Code" }]);
    const file = path.join(f.workspace, "name & whoami.py"); await writeFile(file, "print('not executed')");
    await f.ipc.invoke(channels.act, { path: file, action: "open-editor", editorId: "vscode" });
    assert.deepEqual(f.actions, [["editor", await realpath(code), [await realpath(file)]]]);
    await assert.rejects(f.ipc.invoke(channels.act, { path: file, action: "open-editor", editorId: "C:\\evil.exe" }), /not installed/);
  } finally { await f.close(); assert.equal(path.dirname(installRoot), os.tmpdir()); await rm(installRoot, { recursive: true, force: true }); }
});

test("save-as uses only the selected new destination and preserves existing files", /** 保存只写原生选定的新副本。 / Save only a new copy selected by the native dialog. */ async () => {
  const f = await fixture();
  try {
    const original = path.join(f.workspace, "original.txt"); await writeFile(original, "original");
    assert.deepEqual(await f.ipc.invoke(channels.act, { path: original, action: "save-as" }), { success: false, canceled: true });
    f.picker.save = path.join(f.outside, "copy.txt");
    assert.deepEqual(await f.ipc.invoke(channels.act, { path: original, action: "save-as" }), { success: true });
    assert.equal(await readFile(f.picker.save, "utf8"), "original");
    await writeFile(f.picker.save, "existing destination");
    await assert.rejects(f.ipc.invoke(channels.act, { path: original, action: "save-as" }));
    assert.equal(await readFile(f.picker.save, "utf8"), "existing destination"); assert.equal(await readFile(original, "utf8"), "original");
    await assert.rejects(f.ipc.invoke(channels.act, { path: original, action: "save-as", destination: path.join(f.root, "injected.txt") }));
  } finally { await f.close(); }
});

test("save-as revalidates workspace after native dialog completion", /** 工作区切换后取消旧范围文件操作。 / Reject old-scope file actions after workspace changes. */ async () => {
  let currentRoot = ""; let destination = "";
  const f = await fixture({
    /** 提供可切换授权根。 / Supply a switchable authoritative root. */ getWorkspacePath() { return currentRoot; },
    /** 模拟原生对话框期间切换工作区。 / Simulate a workspace switch during the native dialog. */ async chooseSavePath() { currentRoot = path.dirname(destination); return destination; },
  });
  try {
    currentRoot = f.workspace; destination = path.join(f.outside, "copy.txt"); await writeFile(path.join(f.workspace, "original.txt"), "original");
    await assert.rejects(f.ipc.invoke(channels.act, { workspacePath: f.workspace, path: "original.txt", action: "save-as" }), /Workspace changed/);
    await assert.rejects(readFile(destination));
  } finally { await f.close(); }
});

test("all native file interfaces reject untrusted senders before any dialog or action", /** 鉴权失败不打开对话框或应用。 / Authorization failure opens no dialog or application. */ async () => {
  const f = await fixture();
  try {
    for (const channel of Object.values(channels)) await assert.rejects(f.ipc.invoke(channel, { path: "a.txt" }, "untrusted"), /untrusted/);
    assert.deepEqual(f.actions, []);
  } finally { await f.close(); }
});

test("native application failures remain failures and never become successful receipts", /** 操作系统打开失败如实返回，不伪造成功。 / Preserve operating-system open failures without fabricating success. */ async () => {
  const f = await fixture({ /** 模拟操作系统明确拒绝打开。 / Simulate an explicit operating-system open failure. */ async openDefault() { return "No associated application"; } });
  try {
    await writeFile(path.join(f.workspace, "safe.txt"), "safe");
    await assert.rejects(f.ipc.invoke(channels.act, { path: "safe.txt", action: "open-default" }), /No associated application/);
    await assert.rejects(f.ipc.invoke(channels.act, { path: "safe.txt", action: "execute" }), /Unsupported file action/);
    assert.deepEqual(f.actions, []);
  } finally { await f.close(); }
});
