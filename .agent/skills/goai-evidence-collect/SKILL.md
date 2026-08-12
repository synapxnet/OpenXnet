---
name: goai-evidence-collect
description: Collect a bounded, read-only evidence set across XnetAIOps, XnetDataOps, and XnetMLOps for an OpenXnet incident. Use when an AgentTeams Evidence Agent must choose MCP tools, preserve traceable evidence references, and avoid write operations before root-cause analysis.
---

# GOAI Evidence Collect

Version: `1.1.0`

## Workflow

1. Validate the input against `schemas/input.schema.json`.
2. Confirm the Incident ID, Trace ID, allowed tools, required platform coverage, and approval boundary.
3. Select every allowed read-only tool needed by the fixed incident scenario and cover AIOps, DataOps, and MLOps.
4. Reject write tools, unlisted tools, credentials, raw tokens, and unrelated tenant data.
5. Return the exact output contract from `schemas/output.schema.json`.
6. Validate the result with `node scripts/validate.mjs output <result.json>`.

## Contract

- Purpose: turn an incident into a reproducible cross-platform evidence plan.
- Input: structured Incident/Trace scope, allowed read-only tools, required platforms, and approval-required tools.
- Output: `COLLECT_EVIDENCE`, a concise rationale, confidence, requested tool names, and referenced evidence IDs.
- Call condition: Incident is `OPEN` or being reinvestigated, and a READY AgentTeams Binding exists.
- Dependencies: OpenXnet competition tool registry, MCP-compatible platform adapters, and shared Trace state.
- Failure handling: return no write request; surface missing platform coverage, unavailable tools, or insufficient scope to the Leader.
- Safety boundary: read-only access; never request any tool listed in `approvalRequiredTools` or another write action.
- Reuse value: applies to recommendation capacity, quantitative iteration, feature drift, and other governed multi-step plans with the same evidence envelope.

## Collaboration

The AgentTeams Leader routes this Skill to the Evidence Agent. OpenXnet executes only the tool names returned by the validated result, records the Agent Matrix identity as `actorId`, and sends resulting evidence references back to the Leader.
