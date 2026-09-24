# tasks/

Artefatos de spec do LetsSign, um diretório por funcionalidade: `tasks/prd-<slug>/`.

```
prd.md · techspec.md · tasks.md · [num]_task.md · [num]_task_review.md · bugs.md
```

Gerados pelo harness em `.claude/`, nesta ordem:

```
/gera-prd → /gera-techspec → /gera-tasks → /executar-task ⟳ (→ @task-reviewer)
          → /executar-review → /executar-qa → /executar-bugfix
```

O LetsSign é um **monorepo**: as skills de spec e as de execução vivem no mesmo `.claude/`, e
todas leem e escrevem aqui, em `tasks/prd-<slug>/` a partir da raiz do repositório. O código
fica em `apps/api/` (API NestJS) e `apps/web/` (SPA React).

## O `tasks.md` é o quadro

⚠️ **Este projeto não usa Linear nem nenhum rastreador externo.** Sem um quadro fora do
repositório, o `tasks.md` precisa ser bom o bastante para servir de quadro. Cada tarefa declara:

- o **projeto de destino** — `apps/api`, `apps/web` ou `docs` — definido por **onde o código é
  escrito**, não por quem pediu a funcionalidade;
- as **dependências**, pelo número da tarefa anterior (é o que substitui `blocks`/`blockedBy`);
- o **estado**: `- [ ]` não iniciada · `- [~]` em andamento · `- [x]` concluída.

O cabeçalho traz a contagem (`0 de N concluídas`) e o épico de
[`../docs/backlog/mvp.md`](../docs/backlog/mvp.md) a que a funcionalidade pertence.

⚠️ **Tarefa que toca API e SPA é quebrada em duas**, uma por app, com a dependência declarada
entre elas. Uma tarefa só atravessando as duas não tem como ser revisada nem testada de uma vez
— cada app tem seus próprios comandos de teste, lint e typecheck (ver
[`../.claude/stack-profile.md`](../.claude/stack-profile.md)).

## O que fica registrado ao fim

Cada `[num]_task.md` recebe um `## Log de execução` com o que foi implementado, os arquivos
tocados, os comandos rodados e o desfecho do `task-reviewer`. É o que um comentário de issue
seria, num projeto que tivesse issues.

Quando **todas** as tarefas de um `tasks.md` estão concluídas, o épico fecha em
[`../docs/status.md`](../docs/status.md) — no fechamento do épico, não a cada tarefa: ruído a
cada tarefa faz o arquivo deixar de ser lido, e um arquivo que ninguém lê não controla nada.
