# claude/

This folder contains all AI-assisted project management files for the AF Platform.

## Structure

```
claude/
├── handover/        # Session handover notes (AF-Handover-Notes-v2_XX.md)
├── prompts/         # Active and archived Opus prompts (PROMPT-CURRENT.md, etc.)
└── tests/           # Test list (AF-Test-List.md)
```

## File Conventions

### Handover Notes
- Filename: `AF-Handover-Notes-v2_XX.md`
- Written at end of each session
- Each version supersedes the previous
- Written by Claude AI (Sonnet) via MCP

### Prompts
- `PROMPT-CURRENT.md` — active prompt for Opus in VS Code
- Overwritten each time a new prompt is prepared
- Cleared to `_No active prompt._` after Opus has executed

### Test List
- `AF-Test-List.md` — versioned test tracker
- Updated alongside each handover note
- Maintained by Claude AI (Sonnet) via MCP

## Working Method

- **Claude AI (Sonnet 4.6)** — design, rationale, MCP edits, handover notes, prompt preparation
- **VS Code (Opus 4.6)** — complex coding and file creation
- All files in this folder are written to by Claude AI only
- Developers do not need to edit these files manually
