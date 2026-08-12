import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationDockerContainerMutationRequest,
  parseApplicationDockerImagePullRequest,
  parseApplicationToolchainProbeRequest,
} from "./application-toolchain-runtime";

test("toolchain contract accepts exact allow-listed requests", () => {
  assert.deepEqual(parseApplicationToolchainProbeRequest({ tool: "node" }), { tool: "node" });
  assert.deepEqual(parseApplicationDockerImagePullRequest({ image: "registry.example/app:1.2.3" }), {
    image: "registry.example/app:1.2.3",
  });
  assert.deepEqual(parseApplicationDockerContainerMutationRequest({
    container: "openxnet-worker_1",
    action: "restart",
  }), {
    container: "openxnet-worker_1",
    action: "restart",
  });
});

test("toolchain contract rejects commands, options, whitespace, and extra fields", () => {
  assert.throws(() => parseApplicationToolchainProbeRequest({ tool: "python" }), /tool/i);
  assert.throws(() => parseApplicationToolchainProbeRequest({ tool: "node", command: "calc.exe" }), /fields/i);
  assert.throws(() => parseApplicationDockerImagePullRequest({ image: "--help" }), /image/i);
  assert.throws(() => parseApplicationDockerImagePullRequest({ image: "repo/image latest" }), /image/i);
  assert.throws(() => parseApplicationDockerContainerMutationRequest({
    container: "worker",
    action: "exec",
  }), /action/i);
  assert.throws(() => parseApplicationDockerContainerMutationRequest({
    container: "../worker",
    action: "stop",
  }), /container/i);
});
