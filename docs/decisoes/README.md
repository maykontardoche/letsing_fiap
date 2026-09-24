# Decisões de arquitetura (ADRs)

Cada decisão com impacto duradouro, com o contexto, a escolha e o que se abriu mão. Não se reabre uma
decisão sem motivo novo — e o motivo novo vira um ADR que substitui o anterior.

| # | Decisão | Estado |
|---|---|---|
| [0001](0001-monorepo-nestjs-react.md) | Monorepo com NestJS + Prisma e React + Vite | Aceita |
| [0002](0002-sessao-server-side.md) | Sessão server-side em Redis, não JWT | Aceita |
| [0003](0003-auditoria-na-mesma-transacao.md) | Auditoria encadeada por hash, na mesma transação | Aceita |
| [0004](0004-biometria-no-navegador.md) | Biometria processada no navegador | Aceita |
| [0005](0005-ed25519-e-json-canonico.md) | Ed25519 sobre JSON canônico, com evidências no PDF | Aceita |
| [0006](0006-tenancy-por-extensao-do-prisma.md) | Isolamento por extensão do Prisma + AsyncLocalStorage | Aceita |
