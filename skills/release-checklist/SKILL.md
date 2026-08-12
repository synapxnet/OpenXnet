---
name: release-checklist
description: Prepare a desktop or server release for packaging and distribution. Use when cleaning secrets, validating configs, planning smoke tests, or documenting build steps before a new version ships.
---

# Release Checklist

Use this skill before packaging a version for users.

## Workflow

1. Confirm the upgrade target:
   - from version
   - to version
2. Remove or blank any default secrets.
3. Verify environment-specific endpoints are configurable.
4. Check migrations and compatibility notes.
5. Define the build entrypoint and required prerequisites.
6. Run smoke tests before packaging.
7. Record rollback notes and known risks.

## Pre-package checklist

- No default API keys in source
- No test payment config left enabled
- No developer-only endpoints hardcoded
- Version labels match the intended release
- Build instructions point to the correct repo and entrypoint
