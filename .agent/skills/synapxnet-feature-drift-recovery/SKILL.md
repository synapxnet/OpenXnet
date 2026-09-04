---
name: synapxnet-feature-drift-recovery
description: Diagnose and recover cross-domain feature drift when business outcomes degrade while infrastructure and serving health appear normal. Use for governed lineage analysis, fallback-feature mitigation, historical backfill, retraining, evaluation, canary release, rollback, and independent verification across XnetDataOps, XnetMLOps, and XnetAIOps.
---

# 跨域特征漂移恢复

Version: `1.0.0`

## Workflow

1. Validate input with `schemas/input.schema.json` and `node scripts/validate.mjs input <file>`.
2. Require AIOps alert, service, and workload evidence; DataOps quality, Schema, lineage, and workflow evidence; and MLOps deployment and inference evidence from one Workspace, Incident, and Trace.
3. Halt when evidence is stale, cross-Workspace, contradictory, or does not connect business degradation to an input-contract or upstream lineage change.
4. Submit the complete nine-step recovery plan and two compensation steps to the AgentTeams Leader; do not execute before a distinct human approver fixes the parameter digest and resource version.
5. Apply the certified fallback feature first, backfill 36 months, pass the repaired-dataset gate, retrain, evaluate, register, canary at 5%, promote, and remove fallback in dependency order.
6. Stop on the first failed quality gate. Roll back to the stable revision, preserve the fallback feature, and keep the Incident failed or open.
7. Ask the independent Verifier to re-read business recovery, dataset validation, inference contract, deployment revision, and release state rather than trust Executor receipts.
8. Return the exact output contract and preserve every Evidence ID, Action ID, approval, Matrix event, lineage reference, dataset version, model card, and audit receipt.

## Contract

- Input: bounded Incident/Trace scope, controlled environment, cross-platform evidence IDs, resource version, approval, plan digest, approved steps, compensation steps, and allowed tools.
- Output: terminal outcome, Action ID, completed steps, independent verification evidence, final resource version, retrospective Skill ID, and summary.
- Dependencies: AgentTeams, OpenXnet approval and audit stores, MCP Gateway, XnetDataOps quality/lineage/backfill tools, XnetMLOps feature/training/release tools, and XnetAIOps service evidence.
- Failure handling: return `HALT` before execution for incomplete causality or governance; return `ROLLBACK_REQUIRED` after a failed action, quality gate, or independent verification.
- Security boundary: enforce Workspace scope, human approval, parameter digest, resource version, idempotency, certified fallback set, bounded history window, independent verification, and rollback.
- Reuse value: apply to risk, recommendation, advertising, search, and other feature-driven online models after environment-specific drift thresholds and fallback sets are certified.

Read `references/mcp-tools.md` when selecting tools or reviewing platform ownership.
