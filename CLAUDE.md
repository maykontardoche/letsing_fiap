# CLAUDE.md

Guidance for Claude Code working in this repository.

## O que é

**LetsSign** — plataforma de assinatura eletrônica avançada: upload de PDF com hash SHA-256, convite de
signatários sem conta, verificação de identidade (código por e-mail, rosto com prova de vida, voz, gestos —
processados no navegador), assinatura Ed25519 da plataforma, PDF final com manifesto, QR Code e evidências
embutidas, trilha de auditoria encadeada por hash e validação pública. Projeto acadêmico (FIAP).

Docs e texto de UI em **português do Brasil**. Identificadores de domínio em português (`Documento`,
`Signatario`, `organizacaoId`); termos técnicos em inglês (`useQuery`, `findMany`).

## Estrutura

```
apps/api/   NestJS 11 + Prisma 7 + PostgreSQL 17 + Redis (sessão, tentativas, fila BullMQ)
apps/web/   React 19 + Vite 7 + Tailwind 4 + TanStack Query + React Hook Form/Zod
docs/       status · backlog · arquitetura · segurança · contrato da API · design system · ADRs
tasks/      artefatos de spec: prd-<slug>/{prd,techspec,tasks}.md
.claude/    harness de spec-driven development (ver .claude/README.md)
```

## Como subir

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run setup     # Docker (Postgres 5452, Redis 6392, Mailpit 1035/8035) + migrations + seed
npm run dev       # API :3020, SPA :5190
npm run verificar # lint + typecheck + testes nos dois apps
```

⚠️ As portas fogem do padrão de propósito, para não colidir com outros projetos.

## Regras que o código precisa garantir

- **Isolamento entre organizações é a regra mais séria.** O filtro é automático (extensão do Prisma +
  AsyncLocalStorage em `apps/api/src/common/tenancy/`). Model novo com `organizacaoId` entra em
  `models-escopados.ts` — um teste falha se esquecer. Escrita aninhada informa `organizacaoId` à mão. Recurso
  de outra organização responde **404**.
- **Fechado por padrão:** toda rota exige sessão; `@Publico()` abre. Autorização por **permissão**
  (`@ExigePermissao`), sempre no servidor — esconder botão no React não é autorização.
- **Toda mutação de negócio audita, na mesma transação**, pelo `AuditoriaService`. Trilha append-only e
  encadeada; não existe caminho de edição.
- **DTO declara todos os campos** — o `ValidationPipe` recusa campo extra.
- **Nenhum módulo lê `process.env`** (só `config/env/`) e **módulo não importa módulo irmão** — ESLint garante.
- **Biometria nunca sai do navegador.** O servidor recebe medições e resultado; nunca imagem ou áudio (ADR 0004).
- **O servidor sorteia os desafios** e avalia as respostas; a tela só conduz.
- **Resposta montada campo a campo** — nunca `tokenHash`, `cpfCifrado`, `id` interno ou caminho de arquivo.
- **Nada sensível em log**; auditoria não é log.
- **Frontend:** os 4 estados de tela; filtros na URL; `useConfirmacao()` em ação destrutiva; status nunca
  só por cor; tokens semânticos (tema claro/escuro); contraste AA (há teste); nenhum `fetch` fora de `lib/http.ts`.
- Proibido: `any`, `console.log`, `@ts-ignore`.

## Documentação

Comece por [`docs/status.md`](docs/status.md). Antes de escrever código: [`docs/arquitetura/backend.md`](docs/arquitetura/backend.md)
e [`docs/arquitetura/frontend.md`](docs/arquitetura/frontend.md). Endpoint novo ou alterado → atualize
[`docs/arquitetura/api-contract.md`](docs/arquitetura/api-contract.md) na mesma passada.

## Harness `.claude/`

```
/gera-prd → /gera-techspec → /gera-tasks → /executar-task ⟳ (→ @task-reviewer)
          → /executar-review → /executar-qa → /executar-bugfix
```

Comandos reais de cada app em `.claude/stack-profile.md`. Sem rastreador externo: o estado das tarefas vive
em `tasks/prd-<slug>/tasks.md` e o dos épicos em `docs/status.md`.

## Git

Commits em português, no formato `tipo(escopo): resumo`. **Sem trailer de coautoria de IA.**
