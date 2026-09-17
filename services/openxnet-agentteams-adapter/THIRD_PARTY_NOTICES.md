# Third-Party Notices

## AgentTeams

- Project: `agentscope-ai/AgentTeams`
- Version: `v1.2.0`
- Commit: `793db242257a569d911b1aa59c1cd554af78511f`
- License: Apache License 2.0
- Source: <https://github.com/agentscope-ai/AgentTeams>

The container builds the official `agt` CLI from the fixed commit above and installs the original AgentTeams `LICENSE` at `/usr/share/licenses/AgentTeams/LICENSE`.

## Base Images

- `golang:1.25-alpine`: build stage only; not included as the runtime base image.
- `node:22-alpine`: runtime base image; Node.js is distributed under the MIT License and includes third-party components documented by the upstream image.

OpenXnet Adapter source is licensed under `AGPL-3.0-only`. Third-party components retain their original licenses and notices.
