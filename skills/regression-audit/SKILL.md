---
name: regression-audit
description: Run a structured regression pass and report real bugs with repro paths and risk. Use when validating releases, UI rewrites, or cross-module fixes.
---

# Regression Audit

Use this skill when a feature is "done" but still needs disciplined verification.

## Workflow

1. List the changed surfaces.
2. Define the core user journeys that touch those surfaces.
3. Test each journey for:
   - success path
   - error path
   - theme parity
   - resize or overflow
   - state persistence
4. Record issues with:
   - severity
   - repro steps
   - expected result
   - actual result
5. Re-test the fixes and close the loop.

## Reporting format

```text
Severity:
Area:
Repro:
Expected:
Actual:
Risk:
```
