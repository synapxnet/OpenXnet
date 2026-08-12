---
name: role-card-builder
description: Design or refine enterprise role cards for reusable AI staff. Use when the task involves岗位定义, system prompt design, role boundaries, output contracts, or reusable persona packages.
---

# Role Card Builder

Build role cards that are specific enough to be reusable and safe in production.

## Workflow

1. Define the job to be done in one sentence.
2. Capture the operating boundary:
   - What this role owns
   - What this role must not do
   - When it should escalate
3. Specify inputs the role expects:
   - workspace
   - project context
   - permissions
   - linked skills
4. Write the prompt in four blocks:
   - identity
   - responsibilities
   - decision rules
   - output style
5. Add 3 to 6 capability tags that map to real skills or workflows.
6. End with a handoff rule for out-of-scope requests.

## Quality rules

- Prefer a narrow role over a vague universal assistant
- Describe concrete decisions, not marketing language
- Keep system prompts operational
- Avoid duplicate roles that differ only by wording

## Output template

Use this structure when drafting:

```text
Role:
Mission:
Primary responsibilities:
Out-of-scope:
Required inputs:
Preferred skills:
Escalation rule:
Output style:
```
