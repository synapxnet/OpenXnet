---
name: synapxnet-quantitative-model-iteration
description: Attribute and iteratively improve a quantitative research model after versioned market data becomes ready and baseline factor evidence degrades. Use for governed dataset publication, feature-pipeline publication, bounded training search, held-out evaluation, model registration, simulation canary, rollback, and independent verification across XnetDataOps, XnetMLOps, and XnetAIOps.
---

# 量化模型归因与受控迭代

Version: `1.1.0`

## Workflow

1. Validate input with `schemas/input.schema.json` and `node scripts/validate.mjs input <file>`.
2. Require AIOps service health, DataOps quality and workflow readiness, MLOps attribution, deployment, and inference evidence from one Workspace, Incident, and Trace.
3. Halt when the data partition is incomplete, attribution is stale or contradictory, or the target revision is already superseded.
4. Submit the fixed seven-step plan and rollback step to the AgentTeams Leader; do not execute before a distinct human approver fixes the factor set, plan digest, resource version, and simulation boundary.
5. Verify the versioned `a-share-factor-demo-v1` product, publish the multi-period momentum feature pipeline, run 30 bounded logistic-regression trials, pass held-out AUC/IC/simulation-risk gates, register the model card, and apply 1% then 100% simulation signal traffic in dependency order.
6. Stop on the first failed quality gate. Keep the previous model hot and run only the approved rollback action.
7. Ask the independent Verifier to re-read service health, dataset validation, attribution thresholds, active revision, release status, and inference probe.
8. Return the exact output contract and preserve every Evidence ID, Action ID, approval, Matrix event, trial reference, model card, and audit receipt.

## Contract

- Input: bounded Incident/Trace scope, simulation or controlled environment, evidence IDs, resource version, approval, plan digest, approved steps, rollback step, and allowed tools.
- Output: terminal outcome, Action ID, completed steps, independent verification evidence, final resource version, retrospective Skill ID, and summary.
- Dependencies: AgentTeams, OpenXnet approval and audit stores, MCP Gateway, XnetDataOps dataset tools, XnetMLOps attribution/training/release tools, and XnetAIOps service evidence.
- Failure handling: return `HALT` before execution for incomplete governance; return `ROLLBACK_REQUIRED` after a failed quality gate, release, or independent verification.
- Security boundary: enforce Workspace scope, human approval, factor and parameter digest, resource version, idempotency, `RESEARCH_ONLY / SIMULATION_ONLY`, independent verification, and rollback. Never represent candidate-pool simulation metrics as production investment returns.
- Reuse value: apply to quantitative research, forecasting, ranking, and other governed model-iteration tasks after scenario-specific evaluation thresholds are certified.

Read `references/mcp-tools.md` when selecting tools or reviewing platform ownership.
