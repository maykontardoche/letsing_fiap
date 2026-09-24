---
name: executar-bugfix
description: Reads documented bugs from bugs.md, analyzes root causes, implements fixes with regression tests, and validates the full test suite. Prioritizes fixes by severity (high to low). Updates bugs.md with correction status and generates a final bugfix report. Use when the user asks to fix bugs, resolve issues, or run the bugfix workflow for a feature. Do not use for new feature implementation, code review, or QA testing.
---

# Bug Fix Execution

## Procedures

**Step 1: Context Analysis (Mandatory)**
1. Read the bugs file at `tasks/prd-[feature-slug]/bugs.md` and extract ALL documented bugs.
2. Read the PRD at `tasks/prd-[feature-slug]/prd.md` to understand affected requirements.
3. Read the Tech Spec at `tasks/prd-[feature-slug]/techspec.md` to understand relevant technical decisions.
4. Review project rules for compliance in fixes (`.claude/stack-profile.md`, including the **Forbidden** list, and `CLAUDE.md`).
5. Do NOT skip this step — full context understanding is fundamental for quality fixes.

**Step 2: Plan Fixes (Mandatory)**
1. For each bug, generate a planning summary:
   - Bug ID, Severity (High/Medium/Low), Affected Component and app (`apps/api` or `apps/web`).
   - Root Cause analysis.
   - Files to modify.
   - Fix strategy description.
   - Planned regression tests (unit, integration, E2E).
2. Use Context7 MCP to analyze documentation of involved languages, frameworks, and libraries.

**Step 3: Implement Fixes (Mandatory)**
1. Fix bugs in severity order: High first, then Medium, then Low.
2. For each bug follow this sequence:
   a. Locate and read the affected code.
   b. Reason about the flow causing the bug.
   c. Implement the root-cause fix — no superficial workarounds.
   d. Run the `typecheck` command from `.claude/stack-profile.md` for the affected app, from its directory, after each fix.
   e. Run existing tests to ensure no regressions.

**Step 4: Create Regression Tests (Mandatory)**
1. For each fixed bug, create tests that:
   - Simulate the original bug scenario (test must fail if the fix is reverted).
   - Validate the correct behavior with the fix applied.
   - Cover related edge cases.
2. Choose test type based on bug nature:
   - **Unit test**: Bug in isolated function/method logic (`*.spec.ts` in the API; Vitest in the SPA).
   - **Integration test**: Bug in module communication (e.g., controller + service + database) — `apps/api/test/*.integration.spec.ts`.
   - **E2E test**: Bug visible in the UI or full flow — a Vitest + Testing Library test of the screen, plus behavioral validation (Step 5).
3. A bug of tenant isolation, route protection or missing audit gets a regression case in the integration suite — never only a unit test.

**Step 5: Behavioral Validation (Mandatory when the stack profile defines a QA strategy)**
1. Read the `QA Strategy` section of `.claude/stack-profile.md`.
2. Reproduce the flow that caused the bug using the validation approach defined there
   (request/response checks through the integration tests for the API; Playwright MCP and
   screenshots for the SPA, when available).
3. Capture the evidence format the profile prescribes to prove the fix.

**Step 6: Final Test Execution (Mandatory)**
1. Run ALL tests of every affected app using the `test` command from `.claude/stack-profile.md` (the API integration tests need `npm run infra:up` at the root).
2. Verify ALL pass with 100% success.
3. Run static/type checking and lint using the `typecheck` and `lint` commands from the stack profile. `npm run verificar` at the root runs everything for both apps.
4. The task is NOT complete if any test fails.

**Step 7: Update bugs.md (Mandatory)**
1. For each fixed bug, append to its entry:
   - **Status:** Fixed.
   - **Applied fix:** Brief description.
   - **Regression tests:** List of created tests.

**Step 8: Generate Final Report**
1. Read the report template at `assets/bugfix-report-template.md`.
2. Fill in all sections with actual results.

## Error Handling
- If bugs.md does not exist, halt and report to the user.
- If a bug requires significant architectural changes, document the justification before proceeding.
- If new bugs are discovered during fixes, document them in bugs.md.
- Begin implementation immediately after planning — do not wait for approval.
