"use strict";

const fs = require("node:fs");
const path = require("node:path");

// 固定 Renderer 回归测试清单，防止发布包遗漏测试文件时 Node 静默跳过。
const requiredTests = [
  "tests/renderer_startup_bootstrap.test.cjs",
  "tests/desktop_chat_transport.test.cjs",
  "tests/desktop_cold_start_report.test.cjs",
  "tests/application_kernel_renderer.test.cjs",
  "tests/application_model_asset_renderer.test.cjs",
  "tests/application_provider_runtime_renderer.test.cjs",
  "tests/application_voice_synthesis_renderer.test.cjs",
  "tests/application_vrm_presentation_renderer.test.cjs",
  "tests/application_system_runtime_renderer.test.cjs",
  "tests/application_sticker_artifact_renderer.test.cjs",
  "tests/application_agent_runtime_renderer.test.cjs",
  "tests/application_memory_management_renderer.test.cjs",
  "tests/application_goai_competition_renderer.test.cjs",
  "tests/application_staff_role_studio_renderer.test.cjs",
  "tests/application_enterprise_sandbox_collaboration_renderer.test.cjs",
];

// 检查每个固定测试入口是否随源码发布，缺失时阻断测试命令。
const missingTests = requiredTests.filter(
  (relativePath) => !fs.existsSync(path.resolve(__dirname, "..", relativePath)),
);

if (missingTests.length > 0) {
  process.stderr.write(
    `Renderer 回归测试清单不完整：${missingTests.join(", ")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Renderer 回归测试清单完整：${requiredTests.length}/${requiredTests.length}\n`,
  );
}
