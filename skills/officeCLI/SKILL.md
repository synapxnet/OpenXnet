---
name: officeCLI
description: Create, inspect, and update Office files (.docx, .xlsx, .pptx). Use when the task involves reports, spreadsheets, slide decks, document QA, or Office formatting checks.
---

# officeCLI

Use this skill when the agent needs to handle Office documents instead of plain text files.

## When to use

- Generate a proposal, report, workbook, or presentation
- Inspect an Office file for structure, formatting, or content issues
- Update a document with charts, tables, sections, or revised copy
- Validate that a handoff document is readable before delivery

## Workflow

1. Confirm the target file type: `.docx`, `.xlsx`, or `.pptx`.
2. Prefer structured inspection before editing:
   - `officecli view <file> outline`
   - `officecli view <file> issues`
   - `officecli get <file> <path> --json`
3. For small edits, use `set`, `add`, `move`, or `remove`.
4. For multi-step edits on the same file, use `officecli open` and `officecli close`.
5. Validate the final file before finishing:
   - `officecli validate <file>`

## Good defaults

- Start with `view outline` when the file structure is unknown.
- Use `--json` whenever downstream logic depends on exact field names.
- Keep edits non-destructive when the source file looks user-authored.
- If command syntax is unclear, use help instead of guessing:
  - `officecli docx set`
  - `officecli xlsx add`
  - `officecli pptx get`

## Delivery checklist

- The file opens and validates
- The requested text is present
- Large layout changes are intentional
- No placeholder content remains
