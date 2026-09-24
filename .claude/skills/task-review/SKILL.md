---
name: task-review
description: Reviews completed task implementations against project code standards, static/type compilation, and test suites. Classifies issues by severity (critical, major, minor, positive) and generates a structured review artifact. Use when a task has been completed and needs quality validation before proceeding. Do not use for full code review of branches, QA testing, or bug fixing.
---

# Task Review

## Procedures

**Step 1: Identify the Task**
1. Search for task files matching the pattern `*_task.md` under `tasks/prd-*/` at the repository root.
2. If a task number is provided, find the specific `[num]_task.md` file.
3. If no task number is provided, find the most recent task file.
4. Read and understand the task requirements completely, including its **projeto de destino** (`apps/api`, `apps/web` or `docs`).

**Step 2: Identify Changed Files**
1. Use `git diff` and `git log` to identify files changed as part of this task.
2. Review each changed file carefully.
3. Read the full context of modified files, not just the diffs.

**Step 3: Conduct the Review**
1. Read `references/code-standards.md` for the language-agnostic standards checklist.
2. Read `.claude/stack-profile.md` — `Language & Naming`, the **Forbidden** list, and the section of the target app — and apply them on top of the agnostic standards. **When the profile and an agnostic standard disagree, the profile wins.**
3. Review the code against ALL criteria:
   - **Language**: Docs, UI text and comments in Brazilian Portuguese; domain identifiers in Portuguese, framework terms as the framework names them (see the profile).
   - **Naming**: Follow the naming conventions defined in the stack profile; if the profile defines none, default to camelCase for methods/functions/variables, PascalCase for classes/types, kebab-case for files/directories.
   - **Clear naming**: No abbreviations, no names over 30 characters.
   - **Constants**: No magic numbers — use named constants.
   - **Functions**: Start with a verb, perform a single clear action.
   - **Parameters**: Maximum 3 parameters (use objects for more).
   - **Side effects**: Functions must do mutation OR query, never both.
   - **Conditionals**: Maximum 2 nesting levels, prefer early returns.
   - **Flag parameters**: Never use boolean flags to toggle behavior.
   - **Method size**: Maximum 50 lines per method.
   - **Class size**: Maximum 300 lines per class.
   - **Formatting**: Prettier decides; blank lines only to separate logical blocks.
   - **Comments**: Only to explain *why* (decision, trap) — code should be self-explanatory about *what*.
   - **Variable declarations**: One variable per line, declare close to usage.
   - **Stack-specific rules**: Everything in the profile's **Forbidden** list and the LetsSign gates — tenant isolation (`models-escopados.ts` + isolation test), audit in the same transaction, routes closed by default, DTOs rejecting undeclared fields, no `process.env` outside `apps/api/src/config/env/`, no sibling-module imports, nothing sensitive in logs, biometrics never leaving the browser; in the SPA, the 4 UI states, filters in the URL, `useConfirmacao()`, status never by color alone, semantic tokens (light/dark), WCAG 2.2 AA.
4. Verify compliance with CLAUDE.md and applicable skills.

**Step 4: Classify Issues**
1. For each issue found, classify as:
   - **CRITICAL**: Bugs, security issues, broken functionality, missing error handling, and any stack-specific critical violation listed in the stack profile (`any`, `console.log`, `@ts-ignore`, a model with `organizacaoId` missing from `models-escopados.ts`, a business mutation without audit in the same transaction, a route opened without a conscious `@Publico()`, sensitive data in logs, biometric data sent to the server).
   - **MAJOR**: Project code standard violations, missing tests, bad naming, missing UI state, destructive action without `useConfirmacao()`, status by color only, hardcoded color instead of a token.
   - **MINOR**: Style suggestions, minor improvements, optional optimizations.
   - **POSITIVE**: Well-done things that should be recognized.

**Step 5: Validate Tests and Types**
1. Read `.claude/stack-profile.md` to resolve the project commands for the target app.
2. From the target app's directory, run the `typecheck` command to verify static/type compilation.
3. Run the `lint` command.
4. Run the `test` command to verify all tests pass (the API integration tests need `npm run infra:up` at the root).

**Step 6: Generate Review Artifact**
1. Read the template at `assets/review-artifact-template.md`.
2. Create the file `[num]_task_review.md` in the SAME directory as the `[num]_task.md` file.
3. Apply status criteria:
   - **APPROVED**: No critical or major issues. Production-ready.
   - **APPROVED WITH OBSERVATIONS**: No critical issues, minor or few non-blocking major issues.
   - **CHANGES REQUESTED**: Critical issues found OR multiple major issues that must be resolved.

## Guidelines
- Be thorough but fair: review every changed file, but acknowledge good work.
- Be specific: always reference the exact file and line number for issues.
- Provide solutions: suggest fixes with code examples, not just problems.
- Write the review artifact in Brazilian Portuguese. Code examples follow the project conventions.

## Error Handling
- If no task file is found, report to the user and ask for the task number.
- If git diff shows no changes, report that there is nothing to review.
- If typecheck, lint or tests fail, include failures in the review artifact as critical issues.
