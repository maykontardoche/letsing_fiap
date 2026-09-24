---
name: cria-techspec
description: Creates Technical Specifications from an existing PRD — or, for infrastructure epics that legitimately have no PRD, from the backlog epic in docs/backlog/mvp.md — translating product requirements into architectural decisions and implementation guidance. Performs deep project analysis, uses Context7 MCP for technical research and Web Search for business rules. Use when the user asks to create a tech spec, define architecture, or plan implementation for a feature with an existing PRD. Do not use for PRD creation, task breakdowns, or direct code implementation.
---

# Tech Spec Creation

## Procedures

**Step 1: Validate Prerequisites**
1. Confirm the feature slug has been provided.
2. Identify the **source of requirements**, in this order:
   - `tasks/prd-[feature-slug]/prd.md` — the normal case, for product features.
   - **Infrastructure epic with no product requirement** (scaffold, tooling, CI, observability):
     there is legitimately no PRD. Use the epic section of `docs/backlog/mvp.md` as the
     source, and say so explicitly in the spec's Resumo Executivo.
3. If neither source exists, halt and report.

> A PRD answers *what* and *why* for a **user**. Infrastructure epics have no user and no
> user story — forcing a PRD there produces fiction. Skipping it is allowed **only** in that
> case; a feature that touches product always needs its PRD first.

**Step 2: Analyze the source (Mandatory)**
1. Read the PRD completely — do NOT skip this step. If working from an infrastructure epic,
   read the epic section and its Definition of Done in `docs/backlog/mvp.md` instead.
2. Identify technical content, constraints, and success metrics.
3. Extract core requirements for architectural consideration.

**Step 3: Deep Project Analysis (Mandatory)**
1. Read `.claude/stack-profile.md` completely — architecture rules, multi-tenancy, auth,
   audit, biometrics and the **Forbidden** list constrain every design decision.
2. Read the relevant decision records in `docs/decisoes/`.
3. Explore the codebase (`apps/api/`, `apps/web/`) to discover files, modules, interfaces, and integration points.
4. Map symbols, dependencies, and critical paths.
5. Analyze: callers/callees, configs, middleware, persistence, concurrency, error handling, tests, infra.
6. Explore solution strategies, patterns, risks, and alternatives.

**Step 4: Research (Mandatory)**
1. Use Context7 MCP to resolve technical questions about frameworks and libraries.
2. Perform at least 3 Web Searches to gather business rules and general information.
3. Complete all research BEFORE asking clarification questions.

**Step 5: Technical Clarifications (Mandatory)**
1. Explore the project BEFORE asking questions.
2. Ask focused clarification questions using the AskUserQuestion tool covering:
   - Domain positioning.
   - Data flow.
   - External dependencies.
   - Key interfaces.
   - Test scenarios.
3. Do NOT proceed until answers are received.

**Step 6: Standards Compliance Mapping (Mandatory)**
1. Identify project skills in `.claude/skills/` that apply to this spec.
2. Check the design against the stack profile's non-negotiable rules and state, in the spec:
   - which new models carry `organizacaoId` (and must enter `models-escopados.ts`);
   - which mutations audit through `AuditoriaService`, in the same transaction;
   - which routes are `@Publico()` and which permission (`@ExigePermissao`) guards the rest;
   - that no biometric data leaves the browser and nothing sensitive reaches the logs.
3. Highlight deviations with justification and compliant alternatives.

**Step 7: Generate Tech Spec (Mandatory)**
1. Read the template at `assets/techspec-template.md`.
2. Provide: architecture overview, component design, interfaces, data models, endpoints, integration points, impact analysis, test strategy, observability.
3. Focus on HOW, not WHAT (the PRD owns what/why).
4. Avoid repeating functional requirements from the PRD.
5. The spec is about specification, NOT detailed implementation code.
6. Keep under ~2,000 words.
7. Do NOT deviate from the template structure.
8. Prefer existing libraries over custom development.
9. Name the target app of each component (`apps/api` or `apps/web`) — it drives the task split.

**Step 8: Save Tech Spec (Mandatory)**
1. Save to: `tasks/prd-[feature-slug]/techspec.md`.
2. Confirm the write operation and path.

## Core Principles
- Tech Spec focuses on HOW, not WHAT (PRD owns the what/why).
- Prefer simple, evolutionary architecture with clear interfaces.
- Provide testability and observability considerations upfront.
- Prefer existing libraries over custom solutions.

## Quality Checklist
- [ ] Requirement source reviewed (PRD, or backlog epic for infra epics).
- [ ] Stack profile and relevant `docs/decisoes/` read.
- [ ] Deep repository analysis completed.
- [ ] Key technical clarifications answered.
- [ ] Tech Spec generated using the template.
- [ ] Project skills verified for compliance.
- [ ] Tenancy, audit, route protection and privacy explicitly addressed.
- [ ] File written to `tasks/prd-[feature-slug]/techspec.md`.
- [ ] Final output path provided and confirmed.

## Error Handling
- If the PRD does not exist and the work **is** a product feature, halt and ask the user to
  create it first via the `cria-prd` skill.
- If the PRD does not exist and the work is an **infrastructure epic**, proceed from the
  backlog epic, and record that choice in the spec.
- If Context7 MCP is unavailable, fall back to Web Search for technical documentation.
- If the output file already exists, confirm with the user before overwriting.
