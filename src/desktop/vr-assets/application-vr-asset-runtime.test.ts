import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { LegacyRendererStateSnapshot } from "../contracts/legacy-renderer-state";
import { ApplicationVrAssetRuntimeService } from "./application-vr-asset-runtime";

/** VR Runtime 测试用内存状态边界。 */
class TestVrStateBoundary {
  public settings: Record<string, unknown>;

  /** 创建测试状态；输入初始设置，仅保存 JSON 副本，无磁盘副作用。 */
  public constructor(settings: Record<string, unknown>) {
    this.settings = JSON.parse(JSON.stringify(settings));
  }

  /** 读取测试状态；无输入，返回独立无密钥快照，无副作用。 */
  public getSnapshot(): LegacyRendererStateSnapshot {
    return {
      schema: "openxnet.legacy-renderer-state.v1",
      settingsRevision: 0,
      conversationsRevision: 0,
      generatedAt: "2026-07-29T12:00:00.000Z",
      settings: JSON.parse(JSON.stringify(this.settings)),
      conversations: [],
    };
  }

  /** 保存测试设置；输入精确替换请求，返回更新快照，请求非法时抛错。 */
  public saveSettings(request: unknown): LegacyRendererStateSnapshot {
    assert.ok(request && typeof request === "object" && !Array.isArray(request));
    this.settings = JSON.parse(JSON.stringify((request as { settings: unknown }).settings));
    return this.getSnapshot();
  }
}

/** 返回测试 VRMConfig；无输入，生成覆盖模型、动作、场景和选择状态的设置。 */
function createVrSettings(): Record<string, unknown> {
  return {
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

test("VR Asset Runtime lists packaged assets and manages user files without Python", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-vr-assets-"));
  const vrRoot = path.join(directory, "vrm");
  const uploadRoot = path.join(directory, "uploads");
  const modelDirectory = path.join(vrRoot, "vrm", "Eku_VRM_v1_0_0");
  const motionDirectory = path.join(vrRoot, "animations");
  const sceneDirectory = path.join(vrRoot, "scene");
  mkdirSync(modelDirectory, { recursive: true });
  mkdirSync(motionDirectory, { recursive: true });
  mkdirSync(sceneDirectory, { recursive: true });
  mkdirSync(uploadRoot, { recursive: true });
  writeFileSync(path.join(modelDirectory, "Eku_VRM_v1_0_0.vrm"), "model", "utf8");
  writeFileSync(path.join(motionDirectory, "greeting.vrma"), "motion", "utf8");
  writeFileSync(path.join(sceneDirectory, "home.spz"), "scene", "utf8");
  const sourceMotion = path.join(directory, "用户动作.vrma");
  writeFileSync(sourceMotion, "user motion", "utf8");
  const state = new TestVrStateBoundary(createVrSettings());
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  const runtime = new ApplicationVrAssetRuntimeService({
    vrAssetRoot: vrRoot,
    uploadRoot,
    state,
    cloudModelPaths: ["Cloud Model/Cloud Model.vrm"],
    createId: () => ids.shift() ?? "33333333-3333-4333-8333-333333333333",
  });
  try {
    const initial = await runtime.listAssets();
    assert.equal(initial.defaultModels.length, 1);
    assert.equal(initial.defaultMotions[0]?.path, "/vrm/animations/greeting.vrma");
    assert.equal(initial.defaultScenes[0]?.path, "/vrm/scene/home.spz");
    assert.equal(initial.cloudModels.length, 1);
    assert.equal(initial.cloudModels[0]?.downloaded, false);

    const imported = await runtime.importAsset({
      kind: "motion",
      displayName: "用户动作",
      entry: { source: "path", path: sourceMotion, originalName: "用户动作.vrma" },
    });
    assert.equal(imported.asset.id, "11111111-1111-4111-8111-111111111111.vrma");
    assert.equal(existsSync(path.join(uploadRoot, imported.asset.id)), true);
    const afterImport = await runtime.listAssets();
    assert.equal(afterImport.userMotions[0]?.name, "用户动作");
    const vrmConfig = state.settings.VRMConfig as { selectedMotionIds: string[] };
    assert.deepEqual(vrmConfig.selectedMotionIds, [imported.asset.id]);

    await runtime.deleteAsset({ kind: "motion", assetId: imported.asset.id });
    assert.equal(existsSync(path.join(uploadRoot, imported.asset.id)), false);
    assert.equal((await runtime.listAssets()).userMotions.length, 0);
    await assert.rejects(
      runtime.importAsset({
        kind: "model",
        displayName: "Wrong",
        entry: { source: "path", path: sourceMotion, originalName: "用户动作.vrma" },
      }),
      /extension/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("VR Asset Runtime downloads only fixed cloud catalog models with bounded streaming", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "openxnet-vr-cloud-"));
  const vrRoot = path.join(directory, "vrm");
  const uploadRoot = path.join(directory, "uploads");
  mkdirSync(vrRoot, { recursive: true });
  const state = new TestVrStateBoundary(createVrSettings());
  const requests: { url: string; redirect: string }[] = [];
  const runtime = new ApplicationVrAssetRuntimeService({
    vrAssetRoot: vrRoot,
    uploadRoot,
    state,
    cloudModelPaths: ["Cloud Model/Cloud Model.vrm"],
    remoteBaseUrl: "https://assets.example.test/vrm/",
    fetch: async (url, options) => {
      requests.push({ url, redirect: options.redirect });
      return {
        status: 200,
        headers: { get: (name: string) => name.toLowerCase() === "content-length" ? "11" : null },
        body: (async function* streamModel(): AsyncGenerator<Uint8Array> {
          yield Buffer.from("cloud ");
          yield Buffer.from("model");
        })(),
      };
    },
  });
  try {
    const catalog = await runtime.listAssets();
    const cloudModel = catalog.cloudModels[0];
    assert.ok(cloudModel);
    const downloaded = await runtime.downloadCloudModel({ modelId: cloudModel.id });
    assert.equal(downloaded.asset.source, "cloud");
    assert.equal(existsSync(path.join(uploadRoot, cloudModel.id)), true);
    assert.deepEqual(requests, [{
      url: "https://assets.example.test/vrm/Cloud%20Model/Cloud%20Model.vrm",
      redirect: "manual",
    }]);
    const refreshed = await runtime.listAssets();
    assert.equal(refreshed.cloudModels[0]?.downloaded, true);
    assert.equal(refreshed.userModels[0]?.id, cloudModel.id);
    await assert.rejects(
      runtime.downloadCloudModel({ modelId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.vrm" }),
      /not found/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
