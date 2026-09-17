<!--
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
项目自述与发布入口 / Project readme and release entry points.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
Maintainer: maoyo | Email: synapxnet@gmail.com
-->

# OpenXnet Enterprise AI Workspace

[![GOAI release 1.3.0](https://img.shields.io/badge/GOAI_release-1.3.0-6750A4)](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0)
[![GOAI-Competition](https://img.shields.io/badge/branch-GOAI--Competition-1769AA)](https://github.com/synapxnet/OpenXnet/tree/GOAI-Competition)

**Multiple agents, one accountable business outcome.** OpenXnet is the SynapXnet enterprise collaboration workspace for AI employees, teams, governed Skill/MCP execution, human approval, independent verification, and reusable organizational experience.

**[Download Windows v1.3.0](https://github.com/synapxnet/OpenXnet/releases/download/v1.3.0/OpenXnet-Setup-1.3.0-goai-submission-win-x64.exe) · [Release and source](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0) · [简体中文](README_ZH.md) · [SynapXnet website](https://openxnet.synapxnet.com/index.html)**

## Current GOAI release

The GOAI Agent Infra finals release is **v1.3.0**, centered on cross-domain feature drift recovery. Its tag pins commit `c841ef841da8477fc312e27cd390aecac8ed2d7e`. The release includes the Windows x64 installer, the reviewed source archive, and SHA256 checksums. This branch may receive later documentation updates; use the tag and published assets for a fixed reproduction baseline.

Historical upstream 0.3.8 installers, portable packages, and artifacts for other operating systems are not this release. Use the release page linked above for the current downloads and verification boundaries.

## How the system works

| Responsibility | Component |
|---|---|
| Organize employees, teams and workspaces; initiate tasks and make human decisions | OpenXnet enterprise workspace |
| Plan work and track handoffs between Leader, Evidence Worker and Independent Verifier | AgentTeams |
| Collect platform-specific evidence and expose governed tools for the same incident and Run | Resident agents in AIOps, DataOps and MLOps |
| Check resource scope, parameter digests, approvals, versions and idempotency; retain audit records | Governance and execution boundary |
| Read fresh business and technical evidence before closing or compensating a task | Independent verification |
| Retain sourced, permissioned and versioned experience; propose reusable capabilities | Memory V3 and Skill candidates |

The recovery flow is: business anomaly → cross-domain evidence → plan → human approval → controlled execution → independent verification → closure or compensation. Task context and long-term memory are separate. A Skill candidate does not automatically acquire production execution rights.

## Start with the installed application

1. Install the linked Windows release and sign in with your account or an administrator-issued demo account.
2. Prepare the enterprise sandbox, enterprise space, employees, team and workspace in that order. The team template and incident must use the same workspace.
3. Open **Enterprise Space → Collaboration and Execution Configuration**. Configure the connection and administrator-issued demo access code in the UI, test it and save it. Running a local startup CMD is not required for ordinary installers.
4. Create a cross-domain feature drift recovery incident in the GOAI demo entry and select the matching workspace, team and scenario path.
5. Review evidence and the plan, explicitly approve the proposed objects, parameters, resource versions and rollback points, then continue execution and independent verification.

| Mode | What it exercises |
|---|---|
| Fixture + Builtin | Local process rehearsal without online collaboration |
| Fixture + AgentTeams | Real agent collaboration and governance using fixture platform data; requires a demo access code |
| Live + AgentTeams | Staging platform evidence and controlled execution; requires collaboration access and separate Live authorization for the same workspace |

Model keys, internal execution credentials and demo access codes are not distributed with the source or installer. Service addresses are configurable; changing a server address does not require rebuilding the desktop client.

## Online platform demos and sign-in

These are the GOAI Staging demo endpoints. Repository source pages and release downloads are separate entry points.

| Platform | Online demo | Backend API base | Pinned backend source | Pinned frontend source |
|---|---|---|---|---|
| XnetAIOps | [https://goai.xnetaiops.synapxnet.online/](https://goai.xnetaiops.synapxnet.online/) | `https://goai.xnetaiops.synapxnet.online/api/usr` | [XnetAIops/tree/v1.3.0](https://github.com/synapxnet/XnetAIops/tree/v1.3.0) | [XnetAIops-web/tree/v1.3.0](https://github.com/synapxnet/XnetAIops-web/tree/v1.3.0) |
| XnetDataOps | [https://goai.xnetdataops.synapxnet.online/](https://goai.xnetdataops.synapxnet.online/) | `https://goai.xnetdataops.synapxnet.online/api` | [XnetDataops/tree/v1.3.0](https://github.com/synapxnet/XnetDataops/tree/v1.3.0) | [XnetDataops-web/tree/v1.3.0](https://github.com/synapxnet/XnetDataops-web/tree/v1.3.0) |
| XnetMLOps | [https://goai.xnetmlops.synapxnet.online/](https://goai.xnetmlops.synapxnet.online/) | `https://goai.xnetmlops.synapxnet.online/api` | [XnetMLops/tree/v1.3.0](https://github.com/synapxnet/XnetMLops/tree/v1.3.0) | [XnetMLops-web/tree/v1.3.0](https://github.com/synapxnet/XnetMLops-web/tree/v1.3.0) |

For all three platform demos, use phone **17870171303** and six-digit demo code **000000**. This is administrator-designated demo authentication, not an eight-digit password or proof of a configured SMS delivery service. Protected API endpoints require a login token; an unauthenticated 401 does not mean the platform is offline. Business services also use separate path prefixes documented in each companion repository.

These credentials are for the three platforms only. OpenXnet accounts, AgentTeams demo access codes, workspace Live authorization and model API keys are distinct. The AgentTeams endpoint is `https://goai.xnetaiops.synapxnet.online/agentteams-adapter/`; its access code and Live grants are provided separately. An online resident agent does not mean an AgentTeams team is bound. DataOps currently reports automatic platform-to-platform handoff as pending integration; OpenXnet / AgentTeams orchestrate the cross-domain demo.

The fixed tags retain the original release README. For corrected deployment instructions and current access details, use each companion repository's `GOAI-Competition` README or the guide linked at the top of its release page.

## Companion platform releases

| Platform | Scope | Backend | Frontend |
|---|---|---|---|
| XnetAIOps | Runtime state, business probes and operational assurance | [v1.3.0](https://github.com/synapxnet/XnetAIops/releases/tag/v1.3.0) | [v1.3.0](https://github.com/synapxnet/XnetAIops-web/releases/tag/v1.3.0) |
| XnetDataOps | Data quality, lineage, DAGs and governed dataset operations | [v1.3.0](https://github.com/synapxnet/XnetDataops/releases/tag/v1.3.0) | [v1.3.0](https://github.com/synapxnet/XnetDataops-web/releases/tag/v1.3.0) |
| XnetMLOps | Model contracts, artifacts, evaluation and deployment evidence | [v1.3.0](https://github.com/synapxnet/XnetMLops/releases/tag/v1.3.0) | [v1.3.0](https://github.com/synapxnet/XnetMLops-web/releases/tag/v1.3.0) |

The shared [resident agent implementation](services/platform-resident-agent/DESIGN.md) runs independently with each platform's deployment contract. Platforms retain their own UI and specialist capabilities; OpenXnet and AgentTeams coordinate cross-platform tasks.

## Development and verification

The source uses Python 3.12, [uv](https://docs.astral.sh/uv/getting-started/installation/), Node.js/npm and the external dependencies needed by the selected services. Install these tools before running the commands below. See [pyproject.toml](pyproject.toml), [package.json](package.json) and lock files for dependency versions. After preparing the development environment:

```sh
git clone --branch v1.3.0 --single-branch https://github.com/synapxnet/OpenXnet.git
cd OpenXnet
uv sync
npm ci
npm run dev
```

The clone command selects the frozen `v1.3.0` release baseline. These are developer steps; model configuration, databases and platform deployment are separate prerequisites. Desktop and standalone service packages use their respective build scripts.

The release passed OpenXnet type checking and 144 targeted regressions. The demonstrated success path used Live Staging, while the compensation path used Fixture platform data; both retained real AgentTeams collaboration and human approval. Fixture failure injection is not a production incident, and compensation success is not business recovery.

See the [release notes](https://github.com/synapxnet/OpenXnet/releases/tag/v1.3.0) for actual verification, known issues and installer correspondence. The [finals runbook](docs/GOAI-FINALS-DEMO-RUNBOOK.md) includes design targets and operational references; it is not proof that every target was accepted. The [semifinal runbook](docs/GOAI-SEMIFINAL-RUNBOOK.md) is historical material.

## Digital and physical interaction

VR, VRM interaction and WorldOps remain active development directions using the same perception, risk, human approval, controlled execution and verification boundaries. They are not substituted for the evidence of this release's feature drift scenario. The distributable omits a restricted default VRM; users may import models they are licensed to use.

## Attribution, licenses and contributions

The repository retains author notices from heshengtao / AgentParty historical implementations and third-party components. The root [LICENSE](LICENSE) is AGPL-3.0; component and Memory-specific terms are in [LICENSE-third-party](LICENSE-third-party). This README update does not change those licenses or designate historical upstream downloads as current SynapXnet releases.

Report issues or propose changes through [SynapXnet OpenXnet Issues](https://github.com/synapxnet/OpenXnet/issues) and pull requests. Include integration and validation notes for interface, permission or migration changes.
