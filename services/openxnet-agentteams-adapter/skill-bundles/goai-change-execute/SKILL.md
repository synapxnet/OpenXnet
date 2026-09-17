---
name: goai-change-execute
description: Decide and govern a fixed multi-step capacity, model-iteration, or drift-recovery plan from structured incident evidence. Use when an AgentTeams Leader must determine whether evidence supports a complete remediation plan while preserving human approval, per-step parameter digests, resource versions, idempotency, audit, and compensation boundaries.
---

# GOAI Change Execute

Version: `1.1.0`

## Workflow

1. Validate the input against `schemas/input.schema.json`.
2. Align the scenario's AIOps, DataOps, and MLOps evidence by Incident and Trace.
3. Check that every write and compensation step is listed as approval-required and fixes its tool, resource, parameter digest, target revision, resource version, dependencies, and order.
4. Return `REQUEST_APPROVAL` only when evidence is sufficient; otherwise return `HALT`.
5. Never approve or execute the action inside this Skill.
6. Validate the result with `node scripts/validate.mjs output <result.json>`.

## Contract

- Purpose: convert evidence into a controlled complete-plan recommendation, not an autonomous production write.
- Input: evidence references, ordered main and compensation steps, plan digest, and governance requirements.
- Output: `REQUEST_APPROVAL` or `HALT`, rationale, confidence, no direct tool request, and supporting evidence IDs.
- Call condition: cross-platform evidence collection completed without scope errors.
- Dependencies: shared Trace state, OpenXnet approval control plane, MCP tool registry, and audit receipt store.
- Failure handling: return `HALT` for missing three-platform evidence, plan gaps, dependency errors, conflicting versions, unsupported tools, missing compensation, or low confidence.
- Safety boundary: Leader cannot approve its own request; execution requires a different human approver and operator.
- Reuse value: supports capacity recovery, data repair, model iteration, canary release, traffic shift, rollback, and other governed plans with the same approval envelope.

## Collaboration

The AgentTeams Leader executes this Skill after the Evidence Agent result. OpenXnet creates one approval only from a validated `REQUEST_APPROVAL` result and binds the full plan digest, ordered step scopes, compensation scopes, Leader role card, Matrix sender, Skill version, evidence IDs, and output digest to the same Trace.
