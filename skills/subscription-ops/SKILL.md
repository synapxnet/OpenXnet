---
name: subscription-ops
description: Design or audit subscription packages, quotas, payment states, and entitlement sync. Use when the task involves pricing plans, renewals, package UI, quota visibility, or payment flow behavior.
---

# Subscription Ops

Use this skill when product logic, payment logic, and quota logic must stay aligned.

## Workflow

1. Write down the package matrix:
   - plan name
   - billing cycle
   - price
   - included quota
2. Trace entitlement sync across systems.
3. Verify the payment state machine:
   - pending
   - paid
   - failed
   - expired
   - refreshed
4. Make quota visibility user-facing:
   - current plan
   - remaining quota
   - reset rule
5. Confirm admin changes propagate to the client.

## Rules

- Never unlock entitlements before real payment confirmation
- Prefer clear status text over ambiguous technical labels
- Keep package names stable even if gateway IDs change
