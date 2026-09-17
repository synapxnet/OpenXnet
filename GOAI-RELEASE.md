<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
决赛源码版本对应 / Finals source version correspondence.
Author: maoyo | Department: 研发部 | Date: 2026-09-17
Version: 1.3.0 | Security Level: INTERNAL
__version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
-->

# OpenXnet GOAI Finals V1.3.0

Current source delivery is on `GOAI-Competition`, product version `1.3.0`, with AgentTeams Adapter `1.3.0-live.4`. This commit does not create a release tag or publish a GitHub binary release.

See [V1.3.0 source delivery and verification](docs/GOAI-FINALS-V1.3.0-SOURCE-DELIVERY.md) for component versions, submission scope, passing checks, known limitations, and Live / Fixture evidence boundaries.

The `sbom.cdx.json` inherited from the earlier release is a historical dependency inventory; it has not been regenerated for V1.3.0 and must not be presented as this version's validated SBOM. Current dependency versions are recorded in the committed lock files.

## Archived release baseline

The following section describes the earlier suite and its tag. Its version, base commit and SBOM count do not describe the V1.3.0 delivery above.

# OpenXnet GOAI Competition Suite goai-v1.1.0

## Component

| Field | Value |
| --- | --- |
| Repository | [`synapxnet/OpenXnet`](https://github.com/synapxnet/OpenXnet) |
| Product version | `1.1.0` |
| Suite tag | `goai-v1.1.0` |
| Candidate base commit | `b0d196b127596389f95734763e6732ff233b3d17` |
| Component role | OpenXnet Desktop enterprise control plane and AgentTeams integration |
| Repository license | `AGPL-3.0-only` |
| SBOM components | 1225 dependency records |

## Shared Contract

- AgentTeams topology: Incident Commander / Evidence Agent / Verification Agent.
- Governance Skills: `goai-evidence-collect`, `goai-change-execute`, `goai-service-verify` version `1.1.0` in the Desktop release asset.
- Scenario Skills: recommendation capacity recovery, quantitative model iteration, and feature drift recovery version `1.0.0`.
- MCP protocol: `2026-07-28`.
- Tool contract: `1.0.0`.
- Execution boundary: Workspace-scoped evidence, human approval for high-risk writes, Dry Run, resource version, parameter digest, idempotency, independent verification, audit, and rollback.

## Build and Verification

Use the commands already documented in README and the repository build manifests. Generate artifacts only from this tagged commit or a clean export of it. Do not package local `display` worktrees, caches, `.env` files, credentials, logs, or generated build directories.

The committed `sbom.cdx.json` is generated from repository lock files and build manifests. It records software dependencies declared by this component; runtime infrastructure images and external managed services require separate deployment SBOMs.

## Related Files

- [README.md](./README.md)
- [LICENSE](./LICENSE)
- [NOTICE](./NOTICE)
- [SECURITY.md](./SECURITY.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CycloneDX SBOM](./sbom.cdx.json)
