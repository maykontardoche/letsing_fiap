# Harness `.claude/` — Spec-Driven Development (LetsSign)

Este harness conduz uma funcionalidade da ideia ao código revisado, testado e com bugs
corrigidos. O **processo** é agnóstico de linguagem; tudo que é específico de stack vive em
**`.claude/stack-profile.md`**, escrito para o monorepo do LetsSign (`apps/api` + `apps/web`).

Condução em **Português (BR)**; identificadores de domínio em português, como no código
existente (ver `Language & Naming` no profile).

## Componentes

| Pasta | O que é | Papel |
|-------|---------|-------|
| `commands/` | Entrypoints (slash commands) | Dão contexto + regras `<critical>` e **ativam a skill** correspondente. |
| `skills/` | Procedimentos completos | Passos, `assets/` (templates), `references/` (checklists). |
| `agents/` | Subagentes | `task-reviewer`, acionado ao fim de `executar-task`. |
| `stack-profile.md` | Camada de stack | Comandos por app, arquitetura, naming, QA e observabilidade. As skills leem daqui. |

## Pipeline

```
/gera-prd → /gera-techspec → /gera-tasks → /executar-task ⟳ (→ @task-reviewer)
          → /executar-review → /executar-qa → /executar-bugfix
```

Artefatos em `tasks/prd-[nome-funcionalidade]/`, na raiz do repositório:

```
prd.md · techspec.md · tasks.md · [num]_task.md · [num]_task_review.md · bugs.md
```

## Comandos

| Comando | Skill | Entrada | Saída |
|---------|-------|---------|-------|
| `gera-prd` | `cria-prd` | descrição da feature | `prd.md` |
| `gera-techspec` | `cria-techspec` | `prd.md` | `techspec.md` |
| `gera-tasks` | `criar-tasks` | `prd.md`+`techspec.md` | `tasks.md` + `[num]_task.md` |
| `executar-task` | `executar-task` | `[num]_task.md` | código + testes → `@task-reviewer` |
| `executar-review` | `executar-review` | `git diff` | relatório de review |
| `executar-qa` | `executar-qa` | apps rodando | relatório QA + `bugs.md` |
| `executar-bugfix` | `executar-bugfix` | `bugs.md` | fixes + regressão |

## Dependência de stack (via `stack-profile.md`)

As skills resolvem em runtime, lendo o profile — **na seção da app** onde o código é escrito
(`apps/api` ou `apps/web`):

- **Comandos** (`test`, `typecheck`, `lint`, `dev`, `e2e`) — usados por `executar-review`,
  `executar-qa`, `executar-bugfix`, `task-review`. Rodam a partir do diretório da app; o gate
  final é `npm run verificar` na raiz.
- **Naming & tipos** — `task-review` aplica sobre os padrões agnósticos em
  `task-review/references/code-standards.md`; quando os dois divergem, vale o profile.
- **QA Strategy** — `executar-qa` e `executar-bugfix` decidem driver (testes de integração
  para a API; Vitest + Playwright MCP opcional para o SPA), evidência e acessibilidade
  (WCAG 2.2 AA).
- **Observability** — `cria-techspec` usa no template da Tech Spec.

Trocar de stack = trocar só o `stack-profile.md`. As skills do core não mudam.

### Skills de stack
Além das skills do core, uma stack pode trazer skills próprias em `.claude/skills/`. Elas
ficam listadas na seção **`Stack Skills`** do `stack-profile.md`; `executar-task` consulta
essa lista para carregar a skill certa quando a task toca a tecnologia correspondente. Hoje
não há nenhuma.

## Convenções

- Diretório de trabalho: `tasks/prd-[slug]/` (kebab-case), na raiz do repositório.
- Testes/tipos: comandos do `stack-profile.md` (review/QA/bugfix exigem que passem).
- MCP esperado: Context7 (docs); Playwright MCP é **opcional**, só para QA do SPA
  (http://localhost:5190).
- Gates: review rejeita com teste falhando; QA só aprova com todos os requisitos do PRD
  verificados; bugfix só conclui com 100% dos testes.

## Rastreamento — sem rastreador externo

⚠️ **Este projeto não usa Linear nem nenhum rastreador externo.** O estado do trabalho vive
no próprio repositório:

| O quê | Onde | Quem escreve |
|---|---|---|
| Estado da tarefa | `tasks/prd-<slug>/tasks.md` (`- [ ]` / `- [~]` / `- [x]`) | `executar-task`, passos 0 e 6 |
| O que foi feito | `## Log de execução` no `[num]_task.md` | `executar-task`, passo 8 |
| Estado do épico | `docs/status.md` | `executar-task`, no fechamento do épico |
| Projeto de destino e dependências | `tasks.md`, por tarefa | `criar-tasks`, passo 5 |

A consequência prática: o `tasks.md` **é** o quadro. Ele precisa declarar, por tarefa, o
projeto onde o código é escrito (`apps/api`, `apps/web` ou `docs`) e a dependência pelo número
da tarefa anterior. Sem isso não há como saber o que está pronto para pegar.

## Um repositório, harness completo

O LetsSign é um **monorepo**: há um único `.claude/`, com as duas metades do harness — spec
(`gera-prd`, `gera-techspec`, `gera-tasks`) e execução (`executar-task`, `executar-review`,
`executar-qa`, `executar-bugfix`) — e um único `stack-profile.md`, com uma seção por app.

| | `apps/api` | `apps/web` | `docs` |
|---|---|---|---|
| Comandos | seção `apps/api` do profile | seção `apps/web` do profile | — |
| QA | testes de integração | Vitest + Playwright MCP (opcional) + WCAG 2.2 AA | revisão de conteúdo |

Tarefa que toca as duas apps continua **quebrada em duas**, uma por app, com a dependência
declarada: cada metade é revisada e testada com os comandos da sua app.
