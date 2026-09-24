# 0006 — Isolamento por extensão do Prisma + AsyncLocalStorage

**Estado:** aceita · 2026-09-24

## Contexto

Várias organizações compartilham o mesmo banco. Exigir `where: { organizacaoId }` em cada query depende de
ninguém esquecer, nunca — e o esquecimento é silencioso: a query devolve dados a mais.

## Decisão

- O middleware de sessão abre um contexto `AsyncLocalStorage` com a organização do usuário e chama o
  `next()` **de dentro** dele: guards, controllers e services rodam com a organização na pilha.
- Uma **extensão do Prisma** injeta o filtro no `where` de toda leitura/escrita direcionada dos models de
  negócio e preenche `organizacaoId` na criação — só se estiver em branco.
- A lista de models escopados é **explícita** e um teste a compara com o schema.
- O client cru é **privado**: só existe `prisma.db`, já escopado.
- `semEscopoDeOrganizacao()` é o escape hatch explícito, para login, token de assinatura, validação pública e jobs.
- Promise preguiçosa do Prisma é encadeada dentro do contexto (sem isso, uma query devolvida sem `await`
  executaria fora dele).

## Alternativas descartadas

- **Schema por organização / banco por organização:** isolamento físico mais forte, mas migrations e
  operação multiplicadas — desproporcional para o volume.
- **Row Level Security do Postgres:** ótima segunda camada; fica como evolução (exige conexão com variável de
  sessão por requisição, o que complica o pool).

## Consequências

- ✅ Quem escreve a query não precisa lembrar da organização.
- ✅ Gate de teste de isolamento em todas as rotas.
- ⚠️ Escritas aninhadas não passam pela extensão — nelas o campo é explícito (documentado no schema).
