# Workspace Agent Rules

## Post-Task Action (Always Execute)
- **Target File:** `@PRD.md`
- **Execution:** After completing any code modification, file change, or development task:
  1. Inspect `@PRD.md` and update only the relevant sections (e.g., `Implementation Status`, `Changelog`, or `Feature Checklist`).
  2. Preserve existing requirements, background context, and structural layout—do not overwrite existing specs unless explicitly requested.
  3. Apply changes directly without asking for confirmation.
  4. Include a 1-line note in your final response summarizing what was updated in `@PRD.md`.