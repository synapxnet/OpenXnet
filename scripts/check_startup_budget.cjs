"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_MILESTONES = [
  "head-bootstrap-start",
  "core-bootstrap-ready",
  "vue-mount-start",
  "vue-mount-complete",
  "workspace-ready",
];

/**
 * Parse and validate one structured Electron startup report.
 *
 * @param {string} reportPath Startup report path.
 * @returns {Record<string, unknown>} Validated report object.
 */
function readStartupReport(reportPath) {
  const resolvedPath = path.resolve(reportPath);
  const report = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  if (!report || report.schema !== "openxnet.startup-report.v1") {
    throw new Error("Startup report schema is invalid.");
  }
  return report;
}

/**
 * Validate startup duration, Core bootstrap, render mode, and milestone order.
 *
 * @param {Record<string, unknown>} report Parsed startup report.
 * @param {number} processBudgetMs Maximum desktop process startup duration.
 * @param {number} workspaceBudgetMs Maximum workspace hydration duration.
 */
function checkStartupBudget(report, processBudgetMs, workspaceBudgetMs) {
  const processElapsedMs = Number(report.processElapsedMs);
  const workspaceElapsedMs = Number(report.workspaceElapsedMs);
  if (!Number.isFinite(processElapsedMs) || processElapsedMs < 0) {
    throw new Error("Startup report is missing processElapsedMs.");
  }
  if (!Number.isFinite(workspaceElapsedMs) || workspaceElapsedMs < 0) {
    throw new Error("Startup report is missing workspaceElapsedMs.");
  }
  if (processElapsedMs > processBudgetMs) {
    throw new Error(
      `Process startup ${processElapsedMs} ms exceeds the ${processBudgetMs} ms budget.`,
    );
  }
  if (workspaceElapsedMs > workspaceBudgetMs) {
    throw new Error(
      `Workspace startup ${workspaceElapsedMs} ms exceeds the ${workspaceBudgetMs} ms budget.`,
    );
  }
  const renderer = report.renderer;
  if (!renderer || renderer.bootstrap?.schema !== "openxnet.desktop-bootstrap.v1") {
    throw new Error("Renderer did not receive the Core bootstrap snapshot.");
  }
  if (renderer.precompiledRender !== true) {
    throw new Error("Renderer startup did not use the precompiled Vue render function.");
  }
  const milestones = Array.isArray(renderer.milestones) ? renderer.milestones : [];
  const names = milestones.map((milestone) => milestone?.name);
  let previousIndex = -1;
  for (const requiredName of REQUIRED_MILESTONES) {
    const index = names.indexOf(requiredName);
    if (index <= previousIndex) {
      throw new Error(`Startup milestone '${requiredName}' is missing or out of order.`);
    }
    previousIndex = index;
  }
}

/**
 * Resolve one positive startup budget with legacy environment compatibility.
 *
 * @param {string} environmentName Preferred environment variable name.
 * @param {number} defaultValue Default budget in milliseconds.
 * @returns {number} Validated positive budget.
 */
function resolveStartupBudget(environmentName, defaultValue) {
  const rawValue = process.env[environmentName]
    ?? process.env.OPENXNET_STARTUP_BUDGET_MS
    ?? defaultValue;
  const budgetMs = Number(rawValue);
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new Error(`${environmentName} must be a positive number.`);
  }
  return budgetMs;
}

/** Validate command arguments and enforce the configured startup budget. */
function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    throw new Error("Usage: node scripts/check_startup_budget.cjs <startup-report.json>");
  }
  const processBudgetMs = resolveStartupBudget("OPENXNET_PROCESS_STARTUP_BUDGET_MS", 10_000);
  const workspaceBudgetMs = resolveStartupBudget("OPENXNET_WORKSPACE_STARTUP_BUDGET_MS", 3_000);
  const report = readStartupReport(reportPath);
  checkStartupBudget(report, processBudgetMs, workspaceBudgetMs);
  process.stdout.write(
    `Startup budget passed: process ${report.processElapsedMs} ms <= ${processBudgetMs} ms; `
      + `workspace ${report.workspaceElapsedMs} ms <= ${workspaceBudgetMs} ms.\n`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  checkStartupBudget,
  readStartupReport,
  resolveStartupBudget,
};
