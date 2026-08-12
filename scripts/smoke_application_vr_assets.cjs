"use strict";

const assert = require("node:assert/strict");
const {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");

const {
  ApplicationVrAssetRuntimeService,
  LocalUiGateway,
  registerApplicationVrAssetIpc,
} = require("../build-ts/desktop");

/** VR smoke 使用的内存状态边界。 */
class SmokeVrStateBoundary {
  /** 创建空 VR 配置；无输入，仅初始化内存状态。 */
  constructor() {
    this.settings = {
      VRMConfig: {
        defaultModels: [],
        userModels: [],
        defaultMotions: [],
        userMotions: [],
        selectedMotionIds: [],
        gaussDefaultScenes: [],
        gaussUserScenes: [],
        selectedGaussSceneId: "transparent",
      },
    };
  }

  /** 读取状态；无输入，返回独立无密钥快照，无副作用。 */
  getSnapshot() {
    return {
      schema: "openxnet.legacy-renderer-state.v1",
      settingsRevision: 0,
      conversationsRevision: 0,
      generatedAt: new Date().toISOString(),
      settings: JSON.parse(JSON.stringify(this.settings)),
      conversations: [],
    };
  }

  /** 保存设置；输入精确替换请求，返回更新快照，请求非法时抛错。 */
  saveSettings(request) {
    assert.ok(request?.settings && typeof request.settings === "object");
    this.settings = JSON.parse(JSON.stringify(request.settings));
    return this.getSnapshot();
  }
}

/** 生成测试云 VRM 流；无输入，依次返回两个字节块，无外部副作用。 */
async function* createCloudModelBody() {
  yield Buffer.from("cloud ");
  yield Buffer.from("vrm smoke");
}

/** 通过固定测试响应模拟 Electron 网络栈；输入 URL 和选项，返回分块 VRM，非手动重定向时断言失败。 */
async function fetchCloudModel(url, options) {
  assert.equal(url, "https://assets.example.test/vrm/Cloud%20Smoke/Cloud%20Smoke.vrm");
  assert.equal(options.redirect, "manual");
  return {
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-length" ? "15" : null },
    body: createCloudModelBody(),
  };
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

/** 在真实 preload 中执行 VR 资产生命周期；输入隐藏窗口，返回目录、导入、下载和删除结果，IPC 失败时拒绝。 */
async function exerciseRendererVrAssets(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const runtime = window.openxnetDesktop;
      const before = await runtime.listApplicationVrAssets();
      const input = document.querySelector('#native-vrm');
      const imported = await runtime.importApplicationVrAsset({
        kind: 'model',
        displayName: '本机模型',
        file: input.files[0],
      });
      const cloud = before.cloudModels[0];
      const downloaded = await runtime.downloadApplicationCloudVrmModel({ modelId: cloud.id });
      const after = await runtime.listApplicationVrAssets();
      const deleted = await runtime.deleteApplicationVrAsset({
        kind: 'model',
        assetId: imported.asset.id,
      });
      return { before, imported, downloaded, after, deleted };
    })()
  `, true);
}

/** 运行真实 Electron VR Asset smoke；无输入，输出 JSON，任一资产或按需启动断言失败时抛错。 */
async function runApplicationVrAssetSmoke() {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "openxnet-vr-asset-smoke-"));
  const staticRoot = path.join(temporaryRoot, "ui");
  const vrAssetRoot = path.join(temporaryRoot, "vrm");
  const uploadRoot = path.join(temporaryRoot, "user-data", "uploaded_files");
  const modelRoot = path.join(vrAssetRoot, "vrm", "Eku_VRM_v1_0_0");
  const nativePath = path.join(temporaryRoot, "本机模型.vrm");
  let window = null;
  let gateway = null;
  let cleanupIpc = null;
  let backendActivations = 0;
  try {
    mkdirSync(staticRoot, { recursive: true });
    mkdirSync(modelRoot, { recursive: true });
    mkdirSync(path.join(vrAssetRoot, "animations"), { recursive: true });
    mkdirSync(path.join(vrAssetRoot, "scene"), { recursive: true });
    writeFileSync(
      path.join(staticRoot, "index.html"),
      "<!doctype html><html><body><input id=\"native-vrm\" type=\"file\"></body></html>",
      "utf8",
    );
    writeFileSync(path.join(modelRoot, "Eku_VRM_v1_0_0.vrm"), "packaged vrm smoke", "utf8");
    writeFileSync(path.join(vrAssetRoot, "animations", "greeting.vrma"), "motion smoke", "utf8");
    writeFileSync(path.join(vrAssetRoot, "scene", "home.spz"), "scene smoke", "utf8");
    writeFileSync(nativePath, "native vrm smoke / 中文", "utf8");
    const state = new SmokeVrStateBoundary();
    const runtime = new ApplicationVrAssetRuntimeService({
      vrAssetRoot,
      uploadRoot,
      state,
      cloudModelPaths: ["Cloud Smoke/Cloud Smoke.vrm"],
      remoteBaseUrl: "https://assets.example.test/vrm/",
      fetch: fetchCloudModel,
    });
    gateway = new LocalUiGateway({
      staticRoot,
      artifactRoot: uploadRoot,
      vrAssetRoot,
      getBackendOrigin: () => null,
      activateBackend: async () => {
        backendActivations += 1;
        throw new Error("VR asset smoke must not activate the legacy backend.");
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
    cleanupIpc = registerApplicationVrAssetIpc({
      ipcMain,
      runtime,
      authorizeEvent: (event) => {
        if (event?.sender !== window?.webContents) {
          throw new Error("VR asset smoke IPC sender is not authorized.");
        }
      },
    });
    await window.loadURL(origin);
    await selectNativeFile(window.webContents, "#native-vrm", nativePath);
    const result = await exerciseRendererVrAssets(window);
    assert.equal(result.before.defaultModels.length, 1);
    assert.equal(result.before.defaultMotions.length, 1);
    assert.equal(result.before.defaultScenes.length, 1);
    assert.equal(result.imported.asset.name, "本机模型");
    assert.equal(result.downloaded.asset.source, "cloud");
    assert.equal(result.after.userModels.length, 2);
    assert.equal(result.deleted.assetId, result.imported.asset.id);
    const packagedResponse = await fetch(`${origin}${result.before.defaultModels[0].path}`, {
      headers: { Range: "bytes=0-7" },
    });
    const cloudResponse = await fetch(`${origin}${result.downloaded.asset.path}`);
    assert.equal(packagedResponse.status, 206);
    assert.equal(await packagedResponse.text(), "packaged");
    assert.equal(await cloudResponse.text(), "cloud vrm smoke");
    assert.equal(backendActivations, 0);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      packagedModels: result.before.defaultModels.length,
      importedName: result.imported.asset.name,
      cloudDownloaded: true,
      backendActivations,
    })}\n`);
  } finally {
    cleanupIpc?.();
    if (window && !window.isDestroyed()) window.destroy();
    if (gateway) await gateway.stop();
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

/** 等待 Electron 就绪并运行 smoke；无输入和返回，失败时打印堆栈并以非零状态退出。 */
async function main() {
  try {
    await app.whenReady();
    await runApplicationVrAssetSmoke();
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error);
    app.exit(1);
  }
}

void main();
