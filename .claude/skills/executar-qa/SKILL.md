---
name: executar-qa
description: Validates feature implementation against PRD, Tech Spec, and Tasks through end-to-end testing using the QA strategy defined in the stack profile (request/response checks via integration tests for the API; Vitest plus optional Playwright MCP and WCAG 2.2 AA for the web app). Documents all bugs found with evidence and generates a comprehensive QA report. Use when the user asks to run QA, validate a feature, or test implementation completeness. Do not use for code review, bug fixing, or task implementation.
---

# QA Execution

## Procedures

**Step 1: Documentation Analysis (Mandatory)**
1. Read the PRD at `tasks/prd-[feature-slug]/prd.md` and extract ALL numbered functional requirements.
2. Read the Tech Spec at `tasks/prd-[feature-slug]/techspec.md` and verify implemented technical decisions.
3. Read Tasks at `tasks/prd-[feature-slug]/tasks.md` and verify completion status of each task.
4. Create a verification checklist based on the requirements, noting for each one which app delivers it (`apps/api`, `apps/web`, or both).
5. Do NOT skip this step — understanding requirements is fundamental for QA.

**Step 2: Resolve QA Strategy (Mandatory)**
1. Read the `QA Strategy` section of `.claude/stack-profile.md`.
2. It defines HOW to drive QA for each app: the run/launch command, the test driver
   (integration tests with request/response checks for `apps/api`; Vitest and, when
   available, Playwright MCP for `apps/web`), the evidence format, and the accessibility gates.
3. Follow the strategy from the profile for all steps below. The browser-oriented procedure
   (Steps 4–5, web parts) applies only to requirements delivered through `apps/web`.

**Step 3: Environment Preparation (Mandatory)**
1. Bring the infrastructure up with `npm run infra:up` at the repository root (Postgres, Redis, Mailpit). Run `npm run setup` if the database has never been migrated/seeded.
2. Run the automated suites of each app involved, from its directory: `npm run test` in `apps/api` (unit + integration) and `npm run test` in `apps/web`. Record the results.
3. For browser QA, start the apps with `npm run dev` at the root and connect to the SPA at http://localhost:5190 (API at http://localhost:3020/api). E-mails (invites, verification codes) arrive in Mailpit at http://localhost:8035.
4. Confirm the apps are reachable (`/api/saude/pronto` answers 200) and in a known initial state (seeded data) before testing.

**Step 4: End-to-End Tests (Mandatory)**
1. For API requirements, verify them through the integration tests (`apps/api/test/*.integration.spec.ts`): status code, response envelope, isolation between organizations, route protection, and the audit event produced. A requirement with no covering test is FAILED until one exists.
2. For web requirements, read `references/playwright-tools.md` for the available Playwright MCP tools.
3. For each functional requirement from the PRD:
   a. Drive the feature through the entrypoint from the QA strategy.
   b. Execute the expected flow.
   c. Verify the result.
   d. Capture evidence in the format the profile prescribes.
   e. Mark as PASSED or FAILED.
4. Web only: use `browser_snapshot` before interacting; check `browser_console_messages`
   for JS errors and `browser_network_requests` for API calls — and confirm no biometric
   payload (image, audio, video) is sent to the API.
5. Steps that need a camera or microphone (face liveness, voice, hand gestures) may not be
   executable in the Playwright browser: record them as **NOT VERIFIED, with the reason**,
   not as bugs, and point to the unit tests that cover the logic.

**Step 5: Accessibility & Visual Verification (Mandatory for `apps/web`)**
1. Skip this step only if the feature has no UI.
2. Accessibility (WCAG 2.2 AA, as named in the profile): keyboard
   navigation (Tab/Enter/Escape via `browser_press_key`), visible focus, descriptive labels,
   alt text, color contrast, inputs associated to labels, modal traps focus and `Esc` closes,
   status never by color alone, clear error messages — verify with `browser_snapshot`.
3. Visual: capture screenshots of main screens with `browser_take_screenshot`, verify
   the 4 states (loading, error, empty, with data), **both light and dark themes**, and
   responsiveness; document inconsistencies.
4. If Playwright MCP is unavailable, rely on the Vitest suite (including the contrast test in
   `apps/web/src/test/contratos.test.ts`) and state in the report which checks were not run.

**Step 6: Bug Documentation**
1. For each bug found, document with:
   - Bug ID, Description, Severity (High/Medium/Low), affected app, Evidence (screenshot for UI; request/response or failing test for API).
2. Save bugs to `tasks/prd-[feature-slug]/bugs.md`.
3. If a blocking bug is found, document and report immediately.

**Step 7: Generate QA Report (Mandatory)**
1. Read the report template at `assets/qa-report-template.md`.
2. Fill in all sections with actual results.
3. Set status to APPROVED only when ALL PRD requirements are verified and functioning.

## Error Handling
- If the apps are not running, instruct the user to run `npm run infra:up` and `npm run dev` at the repository root (see `.claude/stack-profile.md`) before retrying.
- If the integration tests cannot connect to Postgres/Redis, the infrastructure is down — bring it up before judging the code.
- If the QA driver is unavailable (Playwright MCP), report it and fall back to the automated suites of each app, listing the checks that remain manual.
- If a blocking bug prevents testing subsequent features, document it and continue with testable areas.
