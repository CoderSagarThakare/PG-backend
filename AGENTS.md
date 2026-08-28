# Workspace Agent Rules

## Quality Assurance & Pre-Implementation Review (Always Execute)
- **Senior QA Testing Standards:** When developing any new feature, code, change, or update, thoroughly test and evaluate it from every aspect (functional, edge cases, performance, security, and UI/UX) with zero tolerance for bugs.
- **Issue & Bug Resolution Approval:** If any potential issues, bugs, problems, or architectural suggestions are identified during development:
  1. **Do not apply changes immediately.**
  2. Clearly document and outline the findings/suggestions first.
  3. Prompt the user for review and explicit approval.
  4. Only proceed with adding or updating the code once both parties have aligned and agreed on the proposed solution.

## Post-Task Action (Always Execute)
- **Target File:** `@PRD.md`
- **Execution:** After completing any code modification, file change, or development task:
  1. Inspect `@PRD.md` and update only the relevant sections (e.g., `Implementation Status`, `Changelog`, or `Feature Checklist`).
  2. Preserve existing requirements, background context, and structural layout—do not overwrite existing specs unless explicitly requested.
  3. Apply changes directly without asking for confirmation.
  4. Include a 1-line note in your final response summarizing what was updated in `@PRD.md`.