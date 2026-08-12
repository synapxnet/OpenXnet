---
name: workspace-ops
description: Create, audit, or repair local, Docker, and remote workspaces. Use when the task involves project paths, permissions, mounts, environment setup, or workspace-role alignment.
---

# Workspace Ops

Use this skill when the workspace itself is part of the problem.

## Workflow

1. Identify the workspace type:
   - local
   - docker
   - ssh or cloud
2. Verify the path or connection first.
3. Confirm write access and expected project contents.
4. Check role alignment:
   - which role owns the workspace
   - which project belongs there
   - which skills need to be available
5. Record environment-specific requirements:
   - image name
   - mount points
   - host and port
   - permission mode
6. Finish with a smoke test inside the workspace.

## Audit checklist

- Path exists
- Credentials are present when required
- Expected repo or files are visible
- Permission mode matches the requested risk level
- Required skill packages can be reached from the workspace
