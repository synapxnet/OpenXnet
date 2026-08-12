"use strict";

const assert = require("node:assert/strict");

const { ApplicationToolchainRuntimeService } = require("../build-ts/desktop");

/** 递归确认公开结果不含路径或命令输出字段；输入未知值，无返回，发现字段时抛出 AssertionError。 */
function assertPublicResult(value) {
  if (Array.isArray(value)) {
    value.forEach(assertPublicResult);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.doesNotMatch(key, /path|stdout|stderr|command/i);
    assertPublicResult(item);
  }
}

/** 执行真实只读 Toolchain smoke；无输入和返回，不拉取镜像或修改容器。 */
async function main() {
  const warnings = [];
  const runtime = new ApplicationToolchainRuntimeService({
    logger: { warn: (message) => warnings.push(message) },
  });
  const startedAt = Date.now();
  const probes = {};
  for (const tool of ["node", "uv", "docker"]) {
    probes[tool] = await runtime.probe({ tool });
    assertPublicResult(probes[tool]);
  }
  assert.equal(probes.node.installed, true, "real Node command was not detected");

  let dockerContainers = null;
  let dockerListError = null;
  if (probes.docker.installed) {
    try {
      dockerContainers = await runtime.listDockerContainers();
      assertPublicResult(dockerContainers);
    } catch (error) {
      dockerListError = error instanceof Error ? error.message : String(error);
      assert.equal(dockerListError, "Docker runtime is unavailable.");
    }
  }
  process.stdout.write(`${JSON.stringify({
    elapsedMs: Date.now() - startedAt,
    probes,
    dockerContainerCount: dockerContainers?.containers?.length ?? null,
    dockerListError,
    warnings,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
