---
name: synapxnet-recommendation-capacity-recovery
description: Recover GPU inference congestion when queue depth, GPU saturation, P99 latency, and success rate degrade without CPU-based HPA activation. Use for governed capacity expansion, runtime tuning, progressive traffic, autoscaling repair, rollback, and independent verification across XnetAIOps, XnetDataOps, and XnetMLOps.
---

# 推荐服务 GPU 拥塞自治恢复

Version: `1.0.0`

## Workflow

1. Validate input with `schemas/input.schema.json` and `node scripts/validate.mjs input <file>`.
2. Require AIOps service, workload, GPU, queue, latency and success-rate evidence plus DataOps workflow and MLOps deployment evidence.
3. Halt when evidence is stale, cross-Workspace, contradictory, or does not identify GPU saturation with queue accumulation.
4. Submit the complete seven-step plan and compensation steps to the AgentTeams Leader; do not execute before a distinct human approver fixes the parameter digest and resource version.
5. Ensure GPU capacity, tune runtime, expand replicas, shift traffic progressively, install queue-aware autoscaling, converge capacity, and normalize runtime in dependency order.
6. Stop on the first failed quality gate. Run only approved compensation steps and keep the Incident open or failed.
7. Ask the independent Verifier to re-read recovery, workload, deployment, workflow, P99, success rate, queue depth, GPU state, ready replicas, and autoscaling policy.
8. Return the exact output contract and preserve every Evidence ID, Action ID, approval, Matrix event, and audit receipt.

## Contract

- Input: bounded Incident/Trace scope, staging or production-like environment, evidence IDs, resource version, approval, plan digest, approved steps, compensation steps, and allowed tools.
- Output: terminal outcome, Action ID, completed steps, independent verification evidence, final resource version, retrospective Skill ID, and summary.
- Dependencies: AgentTeams, OpenXnet approval and audit stores, MCP Gateway, XnetAIOps capacity tools, XnetDataOps workflow evidence, and XnetMLOps deployment evidence.
- Failure handling: return `HALT` before execution for incomplete governance; return `ROLLBACK_REQUIRED` after a failed action or verification.
- Security boundary: enforce maximum replicas, resource version, idempotency, parameter digest, Workspace scope, human approval, and independent verification.
- Reuse value: apply to recommendation, search, advertising, LLM, and vision GPU services only after environment-specific thresholds are certified.

Read `references/mcp-tools.md` when selecting tools or reviewing platform ownership.
