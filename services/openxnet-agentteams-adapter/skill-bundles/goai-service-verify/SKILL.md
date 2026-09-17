---
name: goai-service-verify
description: Independently decide whether a completed multi-step enterprise AI recovery plan can close using scenario-specific AIOps, DataOps, and MLOps evidence. Use when an AgentTeams Verifier must assess objective business and technical thresholds without relying on execution receipts.
---

# GOAI Service Verify

Version: `1.1.0`

## Workflow

1. Validate the input against `schemas/input.schema.json`.
2. Confirm the plan digest, completed-step count, final resource versions, and independent verification evidence belong to the same Incident and Trace.
3. Evaluate every scenario-required capacity, data quality, attribution, revision, release, inference, service-health, and business recovery check.
4. Return `CLOSE` only when every required check passes; otherwise return `ROLLBACK_REQUIRED`.
5. Cite the evidence IDs used for the decision and do not trust the Executor's outcome as verification.
6. Validate the result with `node scripts/validate.mjs output <result.json>`.

## Contract

- Purpose: provide an independent close gate after a governed change.
- Input: completed plan reference, verification evidence references, thresholds, and required checks.
- Output: `CLOSE` or `ROLLBACK_REQUIRED`, rationale, confidence, no write tool request, and supporting evidence IDs.
- Call condition: a non-dry-run action is accepted and objective verification tools have returned.
- Dependencies: scenario-selected XnetAIOps, XnetDataOps, and XnetMLOps verification tools, shared Trace state, and audit receipts.
- Failure handling: return `ROLLBACK_REQUIRED` for incomplete plans or failed, missing, stale, or contradictory checks; OpenXnet then executes the separately approved compensation plan with a non-Verifier identity.
- Safety boundary: Verifier must be distinct from requester, approver, and executor; it cannot mutate the deployment.
- Reuse value: applies to capacity recovery, model iteration, rollback verification, canary promotion, release validation, and post-change health gates.

## Collaboration

The AgentTeams Leader routes this Skill to the Verifier. OpenXnet closes an Incident only when the validated Agent result is `CLOSE` and deterministic threshold checks also pass; either side can veto closure.
