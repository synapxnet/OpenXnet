---
name: security-audit
description: Audit secrets, permissions, auth flows, and risky defaults. Use when reviewing login, provider config, payment, enterprise access control, or release hardening.
---

# Security Audit

Use this skill to reduce avoidable security debt in product flows.

## Workflow

1. Inventory secrets and where they live.
2. Check who can read, write, or trigger each sensitive path.
3. Review auth and verification steps.
4. Identify risky defaults:
   - prefilled keys
   - unlocked enterprise features
   - broad write permissions
   - verbose error leaks
5. Recommend the smallest safe fix set.

## Rules

- Prefer empty defaults over test credentials
- Keep privileged actions auditable
- Treat SMS, payment, and model keys as separate trust zones
- If a value is safe only in dev, make that explicit in code and config
