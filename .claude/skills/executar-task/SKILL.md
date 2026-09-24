---
name: executar-task
description: Implements feature tasks by loading required skills, reading PRD/TechSpec context, analyzing dependencies, and executing the implementation with tests. Task state is tracked in markdown — the task file gets an execution log, tasks.md gets the checkbox, and docs/status.md is refreshed at epic boundaries. Marks tasks as complete in tasks.md and triggers the task-reviewer agent upon completion. Use when the user asks to implement a task, execute a task, or start working on a specific task number. Do not use for creating tasks, running QA, code review, or bug fixing.
---

# Task Execution

> **Este projeto não usa Linear nem qualquer rastreador externo.** O estado do trabalho vive
> no repositório: `tasks/prd-<slug>/tasks.md` para a tarefa, `docs/status.md` para o épico.
> Uma tarefa que não está refletida nesses dois arquivos não está feita.

## Procedures

**Step 0: Abrir a tarefa (MANDATORY — BLOCKING)**

Antes de ler qualquer outra coisa:

1. Localize `tasks/prd-[feature-slug]/[num]_task.md`. Se não existir, **pare e reporte** —
   a tarefa precisa ter sido gerada pela skill `criar-tasks` antes de ser executada.
2. Abra `tasks/prd-[feature-slug]/tasks.md` e confirme que a tarefa está listada e que as
   dependências dela (as tarefas anteriores) estão marcadas como concluídas.
3. Marque a tarefa como **em andamento** no `tasks.md`, trocando `- [ ]` por `- [~]` na
   linha dela, e registre no topo do `[num]_task.md` uma linha de log:
   `> **Em execução** desde <AAAA-MM-DD>.`
4. Identifique **em qual projeto o código será escrito** (`apps/api`, `apps/web` ou `docs`).
   Isso decide qual seção do `.claude/stack-profile.md` vale, qual suíte de testes roda e de
   qual diretório os comandos são executados.
5. Tarefa que toca as duas apps é executada **em duas passadas**, uma por app, e o
   `tasks.md` registra as duas. Cada passada roda os testes e o lint da sua app — nunca
   declare pronta uma metade validada com os comandos da outra.

**Step 1: Pre-Task Configuration (Mandatory)**
1. Read the task definition file at `tasks/prd-[feature-slug]/[num]_task.md`.
2. Read the PRD at `tasks/prd-[feature-slug]/prd.md` for context.
3. Read the Tech Spec at `tasks/prd-[feature-slug]/techspec.md` for technical requirements.
4. Identify dependencies from previous tasks and verify they are complete.
5. Do NOT skip any of these reads.

**Step 2: Load Required Skills**
1. Read `.claude/stack-profile.md` — the common rules plus the section of the app you are
   writing code in — to identify the stack and the technologies involved in the task.
2. Load the corresponding skills from `.claude/skills/` based on technologies used (see the
   profile's `Stack Skills` section).
3. Use Context7 MCP to analyze documentation of involved languages, frameworks, and libraries.

**Step 3: Task Analysis (Mandatory)**
1. Analyze the task considering:
   - Main objectives.
   - How the task fits into the project context.
   - Alignment with project rules and standards.
   - Possible approaches or solutions.
2. Generate a task summary:
   - Task ID and Name.
   - PRD Context (main points).
   - Tech Spec Requirements (key technical requirements).
   - Dependencies.
   - Main Objectives.
   - Risks/Challenges.

**Step 4: Approach Plan (Mandatory)**
1. Define a numbered step-by-step approach.
2. Do NOT skip any step.

**Step 5: Implementation (Mandatory)**
1. Begin implementation immediately after planning.
2. Follow all project standards established in CLAUDE.md and `.claude/stack-profile.md`
   (including the **Forbidden** list).
3. Implement solutions without workarounds.
4. Honor the blocking gates whenever the task touches them:
   - new model with `organizacaoId` → entry in `apps/api/src/common/tenancy/models-escopados.ts`
     and a case in `apps/api/test/isolamento.integration.spec.ts`;
   - business mutation → `AuditoriaService.registrar(..., tx)` in the same transaction;
   - new route → closed by default; `@Publico()` or `@ExigePermissao(...)` decided explicitly;
   - new screen → the 4 UI states, filters in the URL, `useConfirmacao()` for destructive
     actions, status never by color alone, semantic tokens only (light and dark).
5. Create and run all task tests before considering the task finished — `test`, `lint` and
   `typecheck` of the target app, from its directory.

**Step 6: Mark Task Complete (Mandatory)**
1. After successful implementation and tests, mark the task as complete in `tasks.md`
   (`- [x]`), including every subtask.

**Step 7: Review (Mandatory)**
1. Execute the `task-reviewer` agent to review the implementation.
2. Address any issues identified by the reviewer.
3. Do not finalize the task until review issues are resolved.

**Step 8: Fechar o ciclo no repositório (MANDATORY — BLOCKING)**

Sem rastreador externo, o registro do que aconteceu é o próprio repositório. Ele precisa ser
escrito com o mesmo cuidado que um comentário de issue teria.

1. Acrescente ao final de `[num]_task.md` uma seção `## Log de execução` com:
   - o que foi implementado, num parágrafo curto;
   - os arquivos tocados;
   - os comandos rodados e o resultado (`test`, `lint`, `typecheck`);
   - o desfecho do `task-reviewer`, incluindo o que ficou deliberadamente em aberto;
   - a data de conclusão.
2. Confirme no `tasks.md` que a tarefa e todas as subtarefas estão em `- [x]`, e que a
   contagem do cabeçalho (`N de M concluídas`) está correta.
3. Se a tarefa criou ou alterou endpoint, **atualize `docs/arquitetura/api-contract.md`** na
   mesma passada. Contrato que só existe no código é contrato que ninguém encontra.
4. Se a tarefa mudou uma convenção de arquitetura, atualize `.claude/stack-profile.md` e a
   documentação correspondente em `docs/`; se tomou uma decisão nova, registre-a em
   `docs/decisoes/`. Documentação desatualizada é pior que documentação ausente: ela mente
   com autoridade.

**Atualizando `docs/status.md`** (somente quando um épico fecha, não a cada tarefa): quando
**todas** as tarefas do `tasks.md` estiverem em `- [x]`, mova o épico de
`Planejado`/`Pronto para implementar` para `Concluído`, com a data e o link para a pasta
`tasks/prd-<slug>/`, e reveja as outras seções — um épico que termina costuma **destravar**
outro, e um bloqueio que saiu precisa deixar a tabela `Bloqueado`. Atualize a linha
`Última atualização`. Antes de fechar o épico, rode `npm run verificar` na raiz.

> Atualize no fechamento de épico, não a cada tarefa: ruído a cada tarefa faz o arquivo
> deixar de ser lido, e um arquivo que ninguém lê não controla nada.

A tarefa só está encerrada quando o `tasks.md` e o `[num]_task.md` refletem a realidade.
Código pronto com o `tasks.md` desatualizado conta como **não concluída**.

## Error Handling
- If the task file does not exist, halt and report to the user.
- If dependencies are not complete, warn the user and ask whether to proceed.
- If tests fail, fix the issues before marking the task as complete.
- If integration tests fail to connect, check that the infrastructure is up (`npm run infra:up` at the root) before debugging code.
- If the task-reviewer identifies critical issues, address them before finalizing.
- Se a tarefa já estiver marcada `- [x]` no `tasks.md`, pergunte ao usuário antes de
  reexecutá-la — pode ser retrabalho não intencional.
- If the task file and `tasks.md` disagree on scope, the task file wins — update `tasks.md`
  to match, and say so in the execution log.
