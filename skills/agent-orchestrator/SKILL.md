---
name: agent-orchestrator
description: Plan multi-agent execution, task routing, and handoff contracts. Use when work must be split across multiple roles, workspaces, or specialist agents.
---

# Agent Orchestrator

Use this skill to turn one large request into a controlled multi-agent flow.

## Workflow

1. Restate the objective and success condition.
2. Split the work into independent lanes:
   - research
   - implementation
   - review
   - validation
3. Assign one owner per lane.
4. Define the handoff contract for every lane:
   - required inputs
   - expected output
   - failure signal
5. Identify the blocking path and parallel side work.
6. Add a merge step and final verification step.

## Handoff format

```text
Owner:
Task:
Inputs:
Output:
Blockers:
Done when:
```

## Rules

- Do not assign overlapping ownership unless collaboration is explicit
- Keep the critical path short
- Prefer deterministic deliverables over vague brainstorming
- Surface missing dependencies before execution
