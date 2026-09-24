# 0001 — Monorepo com NestJS + Prisma e React + Vite

**Estado:** aceita · 2026-09-24

## Contexto

A versão anterior do LetSing era HTML estático com Bootstrap: dados fixos no código, login simulado,
"assinatura" que era um PDF com um ID aleatório, tudo em `localStorage`. Para virar um sistema de verdade
era preciso backend com banco, sessão, regras de negócio e testes.

## Decisão

- **Monorepo npm workspaces** (`apps/api`, `apps/web`): um repositório para entregar, um comando para
  subir, uma suíte para verificar. Front e API evoluem juntos no mesmo commit.
- **API NestJS 11 + Prisma 7 + PostgreSQL 17 + Redis** — a mesma base do padrão corporativo usado como
  referência (Operations Center): módulos por domínio, DI, guards, extensões do Prisma para multiempresa.
- **SPA React 19 + Vite 7 + Tailwind 4** — API totalmente separada, sem renderização no servidor; o SPA é
  estático e pode ir para qualquer CDN.
- **TypeScript strict** dos dois lados.

## Consequências

- ✅ Um `npm run setup && npm run dev` sobe tudo; `npm run verificar` prova tudo.
- ✅ Separação clara de responsabilidades — autorização sempre no servidor.
- ⚠️ Dois processos em desenvolvimento (resolvido com `concurrently`).
- ⚠️ Docker necessário para Postgres/Redis/Mailpit.
