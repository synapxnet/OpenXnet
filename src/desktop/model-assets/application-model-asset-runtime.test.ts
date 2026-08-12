import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ApplicationModelAssetRuntimeService,
  type ApplicationModelAssetCatalogRelease,
} from "./application-model-asset-runtime";

/** 计算测试字节 SHA-256；输入字节，返回十六进制哈希，无外部副作用。 */
function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** 创建四个完整测试版本；输入 URL 根和内容映射，返回合法清单，不访问网络。 */
function createCatalog(baseUrl: string, contents: Readonly<Record<string, Buffer>>): readonly ApplicationModelAssetCatalogRelease[] {
  /** 创建一个固定测试版本；输入 kind/source/版本和文件名，返回声明，不写磁盘。 */
  function release(
    kind: "sherpa" | "minilm",
    source: "modelscope" | "huggingface",
    version: string,
    names: readonly string[],
  ): ApplicationModelAssetCatalogRelease {
    return {
      kind,
      source,
      version,
      modelName: kind === "sherpa" ? "sherpa-test" : "minilm-test",
      files: names.map((name) => {
        const content = contents[`${kind}:${source}:${name}`];
        assert.ok(content);
        return {
          name,
          url: `${baseUrl}/${kind}/${source}/${name}`,
          size: content.length,
          sha256: hash(content),
        };
      }),
    };
  }
  return [
    release("sherpa", "modelscope", "a".repeat(40), ["model.onnx", "tokens.txt"]),
    release("sherpa", "huggingface", "b".repeat(40), ["model.onnx", "tokens.txt"]),
    release("minilm", "modelscope", "c".repeat(40), ["model.onnx", "tokenizer.json"]),
    release("minilm", "huggingface", "d".repeat(40), ["model.onnx", "tokenizer.json"]),
  ];
}

/** 创建四个版本的确定性测试内容；无输入，返回按版本和文件索引的字节。 */
function createContents(): Readonly<Record<string, Buffer>> {
  return {
    "sherpa:modelscope:model.onnx": Buffer.from("sherpa-modelscope-model", "utf8"),
    "sherpa:modelscope:tokens.txt": Buffer.from("sherpa-modelscope-tokens", "utf8"),
    "sherpa:huggingface:model.onnx": Buffer.from("sherpa-huggingface-model", "utf8"),
    "sherpa:huggingface:tokens.txt": Buffer.from("sherpa-huggingface-tokens", "utf8"),
    "minilm:modelscope:model.onnx": Buffer.from("minilm-modelscope-model", "utf8"),
    "minilm:modelscope:tokenizer.json": Buffer.from("minilm-modelscope-tokenizer", "utf8"),
    "minilm:huggingface:model.onnx": Buffer.from("minilm-huggingface-model", "utf8"),
    "minilm:huggingface:tokenizer.json": Buffer.from("minilm-huggingface-tokenizer", "utf8"),
  };
}

test("Model Asset Runtime downloads, verifies, installs and removes without Worker activation", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-model-assets-"));
  const contents = createContents();
  const baseUrl = "http://127.0.0.1:39001";
  const mutations: string[] = [];
  const requests: string[] = [];
  const progress: string[] = [];
  const runtime = new ApplicationModelAssetRuntimeService({
    modelRoots: { sherpa: path.join(root, "asr"), minilm: path.join(root, "ebd") },
    prepareMutation: async (kind) => { mutations.push(kind); },
    allowInsecureLoopback: true,
    createOperationId: () => "operation-one",
    catalog: createCatalog(baseUrl, contents),
    fetchImplementation: async (input) => {
      const url = String(input);
      requests.push(url);
      const key = url.slice(`${baseUrl}/`.length).replaceAll("/", ":");
      const bytes = contents[key];
      assert.ok(bytes);
      return new Response(bytes, { status: 200, headers: { "Content-Length": String(bytes.length) } });
    },
  });
  const unsubscribe = runtime.subscribe((event) => progress.push(event.phase));
  try {
    assert.equal((await runtime.getStatus({ kind: "sherpa" })).state, "not-installed");
    const installed = await runtime.download({ kind: "sherpa", source: "modelscope" });
    assert.equal(installed.state, "installed");
    assert.equal(installed.files.length, 2);
    assert.equal(requests.length, 2);
    assert.deepEqual(mutations, ["sherpa"]);
    assert.ok(progress.includes("downloading"));
    assert.equal(progress.at(-1), "completed");
    assert.equal((await runtime.getStatus({ kind: "sherpa" })).state, "installed");
    assert.equal(readFileSync(path.join(root, "asr", "sherpa-test", "model.onnx"), "utf8"), "sherpa-modelscope-model");
    assert.equal((await runtime.remove({ kind: "sherpa" })).state, "not-installed");
    assert.deepEqual(mutations, ["sherpa", "sherpa"]);
    assert.equal(existsSync(path.join(root, "asr", "sherpa-test")), false);
  } finally {
    unsubscribe();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Model Asset Runtime preserves an installed model when replacement integrity fails", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "openxnet-model-assets-rollback-"));
  const contents = createContents();
  const baseUrl = "http://127.0.0.1:39002";
  let corruptHuggingFace = false;
  let mutations = 0;
  const runtime = new ApplicationModelAssetRuntimeService({
    modelRoots: { sherpa: path.join(root, "asr"), minilm: path.join(root, "ebd") },
    prepareMutation: async () => { mutations += 1; },
    allowInsecureLoopback: true,
    createOperationId: (() => { let id = 0; return () => `operation-${++id}`; })(),
    catalog: createCatalog(baseUrl, contents),
    fetchImplementation: async (input) => {
      const url = String(input);
      const key = url.slice(`${baseUrl}/`.length).replaceAll("/", ":");
      const expected = contents[key];
      assert.ok(expected);
      const bytes = corruptHuggingFace && key.includes(":huggingface:")
        ? Buffer.alloc(expected.length, 120)
        : expected;
      return new Response(bytes, { status: 200, headers: { "Content-Length": String(bytes.length) } });
    },
  });
  try {
    await runtime.download({ kind: "minilm", source: "modelscope" });
    corruptHuggingFace = true;
    await assert.rejects(runtime.download({ kind: "minilm", source: "huggingface" }), /integrity/i);
    assert.equal(mutations, 1);
    assert.equal(readFileSync(path.join(root, "ebd", "minilm-test", "model.onnx"), "utf8"), "minilm-modelscope-model");
    assert.equal((await runtime.getStatus({ kind: "minilm" })).source, "modelscope");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Model Asset Runtime rejects malformed requests before disk, network or Worker access", async () => {
  const contents = createContents();
  let fetches = 0;
  let mutations = 0;
  const runtime = new ApplicationModelAssetRuntimeService({
    modelRoots: { sherpa: path.join(os.tmpdir(), "unused-sherpa"), minilm: path.join(os.tmpdir(), "unused-minilm") },
    prepareMutation: async () => { mutations += 1; },
    allowInsecureLoopback: true,
    catalog: createCatalog("http://127.0.0.1:39003", contents),
    fetchImplementation: async () => { fetches += 1; throw new Error("must not fetch"); },
  });
  await assert.rejects(runtime.download({ kind: "minilm", source: "modelscope", url: "https://evil.test" }), /fields/i);
  await assert.rejects(runtime.remove({ kind: "voice" }), /kind/i);
  assert.equal(fetches, 0);
  assert.equal(mutations, 0);
});
