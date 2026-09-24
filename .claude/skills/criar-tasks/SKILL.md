---
name: criar-tasks
description: Converts PRD and Tech Spec into a detailed, sequenced list of implementation tasks. Each task is a functional, incremental deliverable with its own test suite. Outputs tasks.md and individual task files under tasks/prd-<slug>/, with no external tracker. Use when the user asks to create tasks, break down work, or plan implementation from an existing PRD and Tech Spec. Do not use for PRD creation, tech spec creation, or actual code implementation.
---

# Task Creation

> **Este projeto não usa Linear nem qualquer rastreador externo.** O quadro de tarefas é o
> `tasks.md` em `tasks/prd-<slug>/`, no próprio repositório. Ele precisa ser bom o bastante
> para servir de quadro — nome claro, ordem de dependência explícita, contagem no cabeçalho.

## Procedures

**Step 1: Validate Prerequisites**
1. Confirm the feature slug has been provided.
2. Verify the Tech Spec exists at `tasks/prd-[feature-slug]/techspec.md`. If missing, halt.
3. Verify the PRD exists at `tasks/prd-[feature-slug]/prd.md`. If missing, check whether the
   Tech Spec declares an **infrastructure epic with no PRD** (see the `cria-techspec` skill,
   Step 1). If it does, proceed using the Tech Spec plus the backlog epic in
   `docs/backlog/mvp.md` as the source. Otherwise halt.

**Step 2: Analyze the source (Mandatory)**
1. Read the Tech Spec completely to extract technical decisions — it is the primary source for
   task breakdown either way.
2. Read the PRD completely to extract requirements. For an infrastructure epic there is none:
   read the backlog epic section and its Definition of Done instead.
3. Identify main components and their dependencies.

**Step 3: Generate High-Level Task List (Mandatory)**
1. Present the high-level task list to the user for approval BEFORE generating any files.
2. Organize tasks by logical deliverable.
3. Order tasks logically: dependencies before dependents (e.g., `apps/api` before `apps/web`, both before E2E checks).
4. Each task MUST be a functional, incremental deliverable.
5. Each task MUST have its own set of unit and integration tests.
6. Limit to a maximum of 15 tasks (group as needed).
7. Wait for user approval before proceeding to Step 4.

**Step 4: Generate Task Files (Mandatory)**
1. Read the tasks summary template at `assets/tasks-template.md`.
2. Read the individual task template at `assets/task-template.md`.
3. Create the summary file: `tasks/prd-[feature-slug]/tasks.md`.
4. Create individual task files: `tasks/prd-[feature-slug]/[num]_task.md`.
5. Use format X.0 for main tasks, X.Y for subtasks.
6. Do NOT repeat implementation details already in the Tech Spec — reference it instead.
7. When a task touches a model with `organizacaoId`, a business mutation, or a route, list the
   matching gate as a requirement: entry in `models-escopados.ts` + isolation test, audit in
   the same transaction, `@Publico()`/`@ExigePermissao` decided explicitly.

**Step 5: Marcar o projeto de cada tarefa (Mandatory)**

Sem rastreador externo, o `tasks.md` é o quadro — e um quadro que não diz **onde o código é
escrito** não serve para nada num monorepo com API e SPA lado a lado.

1. Para cada tarefa principal (X.0), registre no `tasks.md` o **projeto de destino**:
   `apps/api`, `apps/web` ou `docs` (quando a entrega é documentação, contrato ou decisão de
   arquitetura).
2. Tarefa que toca as duas apps é **quebrada em duas** — uma por app — com a dependência
   declarada entre elas. Nunca uma tarefa só atravessando as duas: ela não tem como ser
   revisada nem testada de uma vez.
3. Registre a dependência de cada tarefa pelo número da anterior, no próprio `tasks.md`.
   É o que substitui o `blocks`/`blockedBy` de um rastreador.
4. Escreva no cabeçalho do `tasks.md` a contagem (`0 de N concluídas`) e o épico do backlog
   a que a feature pertence, para manter a rastreabilidade com `docs/backlog/mvp.md`.

**Step 6: Report Results**
1. Present all generated files to the user, com o caminho de cada um.
2. Await confirmation before any implementation begins.

## Guidelines
- Assume the primary reader is a junior developer — be as clear as possible.
- Group tasks by logical deliverable.
- Make each main task independently completable.
- Define clear scope and deliverables for each task.
- Include tests as subtasks within each main task.
- Write task files in Brazilian Portuguese.
- Do NOT implement anything — focus solely on task listing and detailing.

## Quality Checklist
- [ ] Tech Spec analyzed, plus the PRD (or the backlog epic, for infra).
- [ ] High-level task list approved by user.
- [ ] Task files generated using templates.
- [ ] Each task has unit and integration test subtasks.
- [ ] Files saved to `tasks/prd-[feature-slug]/`.
- [ ] **Cada tarefa declara o projeto de destino** (`apps/api`, `apps/web` ou `docs`).
- [ ] **Cada tarefa declara suas dependências** pelo número.
- [ ] Cabeçalho do `tasks.md` com a contagem e o épico do backlog.
- [ ] Results presented to user.

## Error Handling
- If the Tech Spec is missing, halt and direct the user to the `cria-techspec` skill.
- If the PRD is missing and the work is a product feature, halt and direct the user to `cria-prd`. If it is an infrastructure epic, proceed from the Tech Spec + backlog epic.
- If the output directory already contains task files, confirm with the user before overwriting.
