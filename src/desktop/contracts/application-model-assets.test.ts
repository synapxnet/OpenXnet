import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationModelAssetRequest,
  parseDownloadApplicationModelAssetRequest,
} from "./application-model-assets";

test("Model Asset contract accepts only fixed kinds and sources", () => {
  assert.deepEqual(parseApplicationModelAssetRequest({ kind: "sherpa" }), { kind: "sherpa" });
  assert.deepEqual(parseDownloadApplicationModelAssetRequest({ kind: "minilm", source: "modelscope" }), {
    kind: "minilm",
    source: "modelscope",
  });
  assert.throws(() => parseApplicationModelAssetRequest({ kind: "sherpa", path: "C:\\private" }), /fields/i);
  assert.throws(() => parseDownloadApplicationModelAssetRequest({ kind: "minilm", source: "https://example.test" }), /source/i);
});
