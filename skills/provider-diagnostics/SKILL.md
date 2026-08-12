---
name: provider-diagnostics
description: Diagnose model provider connectivity and configuration issues. Use when requests fail because of base URL, API key, model ID, auth, quota, or transport mismatches.
---

# Provider Diagnostics

Use this skill for model provider troubleshooting instead of guessing from one error string.

## Workflow

1. Capture the exact provider inputs:
   - provider name
   - base URL
   - model ID
   - auth mode
2. Separate failure class:
   - DNS or network
   - TLS or proxy
   - auth
   - model not found
   - gateway upstream failure
   - quota or billing
3. Run the smallest possible smoke test.
4. Compare the failing config with a known-good request shape.
5. Report the root cause, not just the final error.

## Rules

- Never assume the model name is valid just because the provider is reachable
- If a gateway succeeds but chat fails, compare request payload shape
- Prefer one passing smoke prompt over broad speculation
- Record the exact field that fixed the issue
