# Prompt Log Archive

## File Naming Convention
PROMPT-LOG-{version_range}.md

Examples:
  PROMPT-LOG-v2.01-v2.10.md
  PROMPT-LOG-v2.11-v2.20.md
  PROMPT-LOG-v2.21-v2.30.md

## Rules
- Each file holds exactly 10 prompt log entries (except the current active file)
- Entries are ordered chronologically, oldest first
- When the active file reaches 10 entries, close it and create a new one
- Version range in filename reflects the first and last prompt version in that file

## Active Log
The current active log (incomplete, <10 entries) is always the highest-numbered file.
The root `claude/PROMPT-LOG.md` is deprecated — all new entries go into the archive files.

## Adding a New Entry
1. Open the highest-numbered archive file
2. If it already has 10 entries, create a new file with the next version range
3. Append the new entry at the bottom
4. Update the filename version range if this entry completes a batch of 10
