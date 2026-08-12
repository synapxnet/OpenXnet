"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { validateColdStartReport } = require("../scripts/smoke_desktop_cold_start.cjs");

/** Build one valid settled cold-start report fixture. */
function createColdStartReport() {
  return {
    schema: "openxnet.startup-report.v1",
    legacyBackendProcessActive: false,
    core: {
      capabilities: [
        { id: "core", state: "ready" },
        { id: "legacy-backend", state: "stopped" },
        { id: "execution-engine", state: "stopped" },
        { id: "voice", state: "stopped" },
        { id: "connectors", state: "stopped" },
        { id: "live", state: "stopped" },
        { id: "mcp", state: "stopped" },
        { id: "agentteams", state: "stopped" },
        { id: "desktop-control", state: "stopped" },
      ],
    },
    renderer: {
      milestones: [
        { name: "workspace-ready" },
        { name: "legacy-renderer-state-ready" },
      ],
      deferredTasks: [
        { name: "server-port-check", status: "scheduled" },
        { name: "auto-update-checks", status: "completed" },
        { name: "chat-services", status: "running" },
      ],
    },
  };
}

test("cold-start report accepts a settled desktop without the legacy backend", () => {
  assert.doesNotThrow(() => validateColdStartReport(createColdStartReport()));
});

test("cold-start report rejects capability activation and live backend processes", () => {
  const activatedCapability = createColdStartReport();
  activatedCapability.core.capabilities[1].state = "ready";
  assert.throws(() => validateColdStartReport(activatedCapability), /entered 'ready'/);

  const activeProcess = createColdStartReport();
  activeProcess.legacyBackendProcessActive = true;
  assert.throws(() => validateColdStartReport(activeProcess), /process was active/);
});
