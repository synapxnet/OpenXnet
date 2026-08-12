import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationToolchainRuntimeService,
  createToolchainChildEnvironment,
  ToolchainCommandError,
  type ToolchainCommandResult,
} from "./application-toolchain-runtime";

/** 记录固定命令并按参数返回测试输出。 */
class TestCommandRunner {
  public readonly calls: Array<{
    command: string;
    arguments_: readonly string[];
    timeoutMs: number;
    environment: Readonly<NodeJS.ProcessEnv>;
  }> = [];

  /** 返回固定命令结果；输入命令、参数、超时和环境，未知调用时抛出 Error。 */
  public async run(
    command: string,
    arguments_: readonly string[],
    timeoutMs: number,
    environment: Readonly<NodeJS.ProcessEnv>,
  ): Promise<ToolchainCommandResult> {
    this.calls.push({ command, arguments_, timeoutMs, environment });
    if (command === "node") return { stdout: "v22.1.0\n", stderr: "", exitCode: 0 };
    if (arguments_[0] === "ps") {
      return {
        stdout: [
          JSON.stringify({ ID: "abc123", Names: "worker", Image: "openxnet/worker:latest", Status: "Up 5 minutes", Ports: "3000/tcp" }),
          JSON.stringify({ ID: "def456", Names: "database", Image: "postgres:16", Status: "Exited (0)", Ports: "--" }),
        ].join("\n"),
        stderr: "",
        exitCode: 0,
      };
    }
    if (arguments_[0] === "stats") {
      return {
        stdout: JSON.stringify({ ID: "abc123", Name: "worker", CPUPerc: "1.25%", MemUsage: "32MiB / 1GiB" }),
        stderr: "",
        exitCode: 0,
      };
    }
    if (["pull", "start", "stop", "restart"].includes(arguments_[0] ?? "")) {
      return { stdout: "completed", stderr: "", exitCode: 0 };
    }
    throw new Error("Unknown test command.");
  }
}

test("toolchain Runtime uses exact commands and returns bounded Docker summaries", async () => {
  const runner = new TestCommandRunner();
  const runtime = new ApplicationToolchainRuntimeService({
    runCommand: runner.run.bind(runner),
    environment: {
      PATH: "C:\\tools",
      OPENXNET_PROVIDER_CREDENTIALS_B64: "secret",
      GITHUB_TOKEN: "secret",
      NODE_OPTIONS: "--require malicious.js",
    },
  });

  const probe = await runtime.probe({ tool: "node" });
  const containers = await runtime.listDockerContainers();
  const pulled = await runtime.pullDockerImage({ image: "openxnet/worker:latest" });
  const restarted = await runtime.mutateDockerContainer({ container: "worker", action: "restart" });

  assert.equal(probe.version, "v22.1.0");
  assert.equal(containers.containers.length, 2);
  assert.equal(containers.containers[0]?.cpu, "1.25%");
  assert.equal(containers.containers[1]?.statusKind, "gray");
  assert.equal(pulled.operation, "pull");
  assert.equal(restarted.operation, "restart");
  assert.deepEqual(runner.calls.map((call) => [call.command, call.arguments_[0]]), [
    ["node", "--version"],
    ["docker", "ps"],
    ["docker", "stats"],
    ["docker", "pull"],
    ["docker", "restart"],
  ]);
  assert.ok(runner.calls.every((call) => call.environment.OPENXNET_PROVIDER_CREDENTIALS_B64 === undefined));
  assert.ok(runner.calls.every((call) => call.environment.GITHUB_TOKEN === undefined));
  assert.ok(runner.calls.every((call) => call.environment.NODE_OPTIONS === undefined));
});

test("toolchain Runtime validates mutations before command execution and redacts failures", async () => {
  let calls = 0;
  const runtime = new ApplicationToolchainRuntimeService({
    runCommand: async () => {
      calls += 1;
      throw new Error("private docker diagnostic C:\\secret");
    },
    logger: { warn: () => undefined },
  });

  await assert.rejects(runtime.pullDockerImage({ image: "--config" }), /image/i);
  assert.equal(calls, 0);
  await assert.rejects(runtime.pullDockerImage({ image: "openxnet/worker:latest" }), {
    message: "Docker runtime operation failed.",
  });
  assert.equal(calls, 1);
});

test("toolchain Runtime reports a missing Docker command without a legacy backend", async () => {
  const runtime = new ApplicationToolchainRuntimeService({
    runCommand: async () => { throw new ToolchainCommandError(true); },
  });
  const result = await runtime.listDockerContainers();
  assert.equal(result.installed, false);
  assert.deepEqual(result.containers, []);
});

test("toolchain child environment removes private envelopes and package-manager secrets", () => {
  const environment = createToolchainChildEnvironment({
    PATH: "C:\\tools",
    PATHEXT: ".EXE;.CMD",
    DOCKER_CONFIG: "C:\\docker",
    OPENXNET_TASK_RPC_TOKEN: "secret",
    ANTHROPIC_API_KEY: "secret",
    UV_INDEX_URL: "https://user:password@example.test/simple",
    NPM_TOKEN: "secret",
  });
  assert.equal(environment.PATH, "C:\\tools");
  assert.equal(environment.DOCKER_CONFIG, "C:\\docker");
  assert.equal(environment.OPENXNET_TASK_RPC_TOKEN, undefined);
  assert.equal(environment.ANTHROPIC_API_KEY, undefined);
  assert.equal(environment.UV_INDEX_URL, undefined);
  assert.equal(environment.NPM_TOKEN, undefined);
});
