"use strict";

const assert = require("node:assert/strict");
const { createWriteStream, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const archiver = require("archiver");
const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationExtensionRuntimeService,
  ApplicationSkillRuntimeService,
  LocalUiGateway,
  registerApplicationExtensionRuntimeIpc,
  registerApplicationSkillRuntimeIpc,
} = require("../build-ts/desktop");

/** Extensions/Skills smoke 使用的 Main-owned 工作区状态边界。 */
class SmokeSkillStateBoundary {
  /** 创建测试状态；输入工作区，仅保存路径，无磁盘副作用。 */
  constructor(workspace) {
    this.workspace = workspace;
  }

  /** 读取测试状态；无输入，返回当前工作区快照，无副作用。 */
  getSnapshot() {
    return {
      schema: "openxnet.legacy-renderer-state.v1",
      settingsRevision: 0,
      conversationsRevision: 0,
      generatedAt: new Date().toISOString(),
      settings: { CLISettings: { cc_path: this.workspace } },
      conversations: [],
    };
  }
}

/** 创建 smoke ZIP；输入目标和条目，返回完成 Promise，归档写入失败时拒绝。 */
function createZip(destination, entries) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = archiver("zip", { zlib: { level: 0 } });
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.pipe(output);
    for (const entry of entries) archive.append(entry.content, { name: entry.name });
    void archive.finalize();
  });
}

/** 通过 Chromium 调试协议给隐藏页面注入真实本机文件；输入 WebContents、选择器和路径，无返回，失败时抛错。 */
async function selectNativeFile(webContents, selector, filePath) {
  webContents.debugger.attach("1.3");
  try {
    await webContents.debugger.sendCommand("DOM.enable");
    const document = await webContents.debugger.sendCommand("DOM.getDocument", { depth: 1 });
    const target = await webContents.debugger.sendCommand("DOM.querySelector", {
      nodeId: document.root.nodeId,
      selector,
    });
    assert.ok(target.nodeId, `Missing smoke file input: ${selector}`);
    await webContents.debugger.sendCommand("DOM.setFileInputFiles", {
      nodeId: target.nodeId,
      files: [filePath],
    });
  } finally {
    webContents.debugger.detach();
  }
}

/** 在真实 preload 中执行扩展与技能生命周期；输入隐藏窗口，返回 typed Runtime 结果，IPC 失败时拒绝。 */
async function exerciseRenderer(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const extensionInput = document.querySelector('#extension-zip');
      const skillInput = document.querySelector('#skill-zip');
      const beforeExtensions = await runtime.listApplicationExtensions();
      const extensionInstall = await runtime.importApplicationExtensionArchive({ file: extensionInput.files[0] });
      const staticStart = await runtime.startApplicationExtension({ extensionId: extensionInstall.extension.id });
      const nodeStart = await runtime.startApplicationExtension({ extensionId: 'node-smoke' });
      await runtime.stopApplicationExtension({ extensionId: 'node-smoke' });
      const beforeSkills = await runtime.listApplicationSkills();
      const skillInstall = await runtime.importApplicationSkillArchive({ file: skillInput.files[0] });
      await runtime.syncApplicationProjectSkill({ skillId: 'smoke-skill', action: 'install' });
      const projectStatus = await runtime.getApplicationProjectSkillStatus();
      const crystallized = await runtime.crystallizeApplicationSkill({
        name: 'Smoke 结晶技能',
        skillId: 'smoke-crystal',
        description: '真实 Electron 技能结晶验证',
        workflow: '检查 typed IPC\\n确认 UTF-8 内容',
        syncToProject: true,
      });
      const crystalContent = await runtime.getApplicationSkillContent({ skillId: 'smoke-crystal' });
      return {
        beforeExtensions,
        extensionInstall,
        staticStart,
        nodeStart,
        beforeSkills,
        skillInstall,
        projectStatus,
        crystallized,
        crystalContent,
      };
    })()
  `, true);
}

/** 运行真实 Electron Extensions/Skills smoke；无输入，输出 JSON，任一链路或按需启动断言失败时抛错。 */
async function runSmoke() {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-extension-skill-smoke-"));
  const staticRoot = path.join(root, "ui");
  const extensionRoot = path.join(root, "user-data", "ext");
  const globalSkillsRoot = path.join(root, "global", "skills");
  const bundledSkillsRoot = path.join(root, "bundled-skills");
  const workspace = path.join(root, "workspace");
  const nodeExtensionRoot = path.join(extensionRoot, "node-smoke");
  const bundledSkillRoot = path.join(bundledSkillsRoot, "bundled-smoke");
  const extensionZip = path.join(root, "本机扩展.zip");
  const skillZip = path.join(root, "本机技能.zip");
  let window = null;
  let gateway = null;
  let extensionRuntime = null;
  let cleanupExtensionIpc = null;
  let cleanupSkillIpc = null;
  let backendActivations = 0;
  try {
    mkdirSync(staticRoot, { recursive: true });
    mkdirSync(nodeExtensionRoot, { recursive: true });
    mkdirSync(bundledSkillRoot, { recursive: true });
    mkdirSync(workspace, { recursive: true });
    writeFileSync(
      path.join(staticRoot, "index.html"),
      "<!doctype html><html><body><input id=\"extension-zip\" type=\"file\"><input id=\"skill-zip\" type=\"file\"></body></html>",
      "utf8",
    );
    writeFileSync(path.join(nodeExtensionRoot, "package.json"), JSON.stringify({ name: "Node Smoke", dependencies: {} }), "utf8");
    writeFileSync(
      path.join(nodeExtensionRoot, "index.js"),
      "const http=require('node:http');http.createServer((_q,r)=>r.end('node smoke')).listen(Number(process.argv[2]),'127.0.0.1');\n",
      "utf8",
    );
    writeFileSync(
      path.join(bundledSkillRoot, "SKILL.md"),
      "---\nname: \"Bundled Smoke\"\ndescription: \"Bundled skill\"\n---\n\n# Bundled Smoke\n",
      "utf8",
    );
    await createZip(extensionZip, [
      { name: "index.html", content: "<!doctype html><title>本机扩展 Smoke</title>" },
      { name: "package.json", content: JSON.stringify({ name: "本机扩展 Smoke" }) },
    ]);
    await createZip(skillZip, [{
      name: "smoke-skill/SKILL.md",
      content: "---\nname: \"本机技能 Smoke\"\ndescription: \"Imported skill\"\n---\n\n# 本机技能 Smoke\n",
    }]);

    extensionRuntime = new ApplicationExtensionRuntimeService({
      extensionRoot,
      nodeExecutable: process.execPath,
      npmCliPath: path.join(__dirname, "..", "node_modules", "npm", "bin", "npm-cli.js"),
      logger: console,
    });
    const skillRuntime = new ApplicationSkillRuntimeService({
      globalSkillsRoot,
      bundledSkillsRoot,
      state: new SmokeSkillStateBoundary(workspace),
      logger: console,
    });
    gateway = new LocalUiGateway({
      staticRoot,
      getBackendOrigin: () => null,
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("Extensions/Skills smoke must not activate the legacy backend.");
      },
    });
    const origin = await gateway.start();
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, "../static/js/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    cleanupExtensionIpc = registerApplicationExtensionRuntimeIpc({
      ipcMain,
      runtime: extensionRuntime,
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Extension smoke IPC sender is not authorized.");
      },
    });
    cleanupSkillIpc = registerApplicationSkillRuntimeIpc({
      ipcMain,
      runtime: skillRuntime,
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) throw new Error("Skill smoke IPC sender is not authorized.");
      },
      revealDirectory: async () => "",
    });
    await window.loadURL(origin);
    await selectNativeFile(window.webContents, "#extension-zip", extensionZip);
    await selectNativeFile(window.webContents, "#skill-zip", skillZip);
    const result = await exerciseRenderer(window);
    assert.equal(result.beforeExtensions.extensions.length, 1);
    assert.equal(result.extensionInstall.extension.name, "本机扩展 Smoke");
    assert.equal(result.staticStart.mode, "static");
    assert.equal(await (await fetch(result.staticStart.url)).text(), "<!doctype html><title>本机扩展 Smoke</title>");
    assert.equal(result.nodeStart.mode, "node");
    assert.equal(result.beforeSkills.skills[0].id, "bundled-smoke");
    assert.deepEqual(result.skillInstall.installedIds, ["smoke-skill"]);
    assert.equal(result.projectStatus.installedIds.includes("smoke-skill"), true);
    assert.deepEqual(result.crystallized.installedIds, ["smoke-crystal"]);
    assert.match(result.crystalContent.content, /真实 Electron 技能结晶验证/);
    assert.equal(result.crystalContent.content.includes("\r\n"), false);
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      extensionImported: result.extensionInstall.extension.id,
      nodeMode: result.nodeStart.mode,
      skillImported: result.skillInstall.installedIds[0],
      crystallized: result.crystallized.installedIds[0],
      backendActivations,
    })}\n`);
  } finally {
    cleanupExtensionIpc?.();
    cleanupSkillIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    if (extensionRuntime) await extensionRuntime.close();
    rmSync(root, { recursive: true, force: true });
  }
}

/** 等待 Electron 就绪并运行 smoke；无输入和返回，失败时打印堆栈并以非零状态退出。 */
async function main() {
  try {
    await app.whenReady();
    await runSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
