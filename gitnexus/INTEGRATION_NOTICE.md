# GitNexus Integration Notice

## Source Project
- **Name**: GitNexus
- **Version**: 1.6.2
- **Author**: Abhigyan Patwari
- **Repository**: https://github.com/abhigyanpatwari/GitNexus
- **License**: PolyForm Noncommercial 1.0.0

## Integration Method
This directory contains the source code of GitNexus, integrated into
OpenXnet as a code intelligence subsystem. GitNexus is used as a local
MCP server providing code knowledge graph capabilities.

## License Compliance
- This integration is for **noncommercial, research, and personal use** only
- Commercial distribution requires a separate commercial license from the author
- Contact: founders@akonlabs.com
- Full license text: see LICENSE file in this directory

## Files Included
- `src/` — Core TypeScript source (315 files)
- `package.json` — Dependencies and entry points
- `tsconfig.json` — TypeScript configuration
- `vendor/` — Vendored dependencies
- `scripts/` — Build and utility scripts
- `skills/` — Skill definitions
- `hooks/` — Git hooks

## Companion Package
- `../gitnexus-shared/` — Shared TypeScript types and schema constants

## Integration Date
2026-04-19

## Modifications from Original
None — source is used as-is. OpenXnet connects via MCP stdio protocol.
