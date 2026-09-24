# Status do projeto

> Comece por aqui para saber onde o projeto está. Atualizado pelo `executar-task` ao fechar um épico.
> Última atualização: **2026-09-24**.

## Concluído

| Épico | O quê | Onde |
|---|---|---|
| **E0 — Fundação** | Monorepo, Docker Compose (Postgres 17, Redis 7, Mailpit), ambiente validado no boot, logger com redação, health checks, ESLint/Prettier, design system com tema claro/escuro | raiz, `apps/*` |
| **E1 — Núcleo de segurança** | Multi-tenancy (AsyncLocalStorage + extensão do Prisma), sessão server-side, guard fechado por padrão, RBAC por permissão, CSRF por origem, limite de tentativas, MFA TOTP, cifra AES-GCM, scrypt | `apps/api/src/common/` |
| **E2 — Autenticação** | Cadastro de organização, login, MFA, recuperação de senha, convite de equipe; telas correspondentes | `modules/autenticacao`, `modules/me`, `pages/auth` |
| **E3 — Documentos** | Upload com validação de PDF e SHA-256, rascunho, signatários (CPF cifrado), níveis de verificação, ordem sequencial, prazo, envio com cota do plano, cancelamento, reenvio com rotação de link | `modules/documentos`, `pages/app/documentos` |
| **E4 — Assinatura** | Fluxo sem conta pelo link; desafios sorteados no servidor (código, rosto, voz, gestos); assinatura Ed25519; recusa; conclusão idempotente com PDF final, manifesto, QR e evidências | `modules/assinatura`, `common/assinaturas`, `pages/assinar` |
| **E5 — Auditoria e validação** | Trilha append-only encadeada por hash, exame de integridade, exportação CSV; validação pública por código ou hash | `common/auditoria`, `modules/validacao`, `pages/publico/ValidarPage` |
| **E6 — Gestão** | Painel com indicadores e gráficos, equipe e papéis, organização e plano, notificações, sessões ativas | `modules/{painel,equipe,organizacao}` |
| **E7 — Qualidade** | 147 testes (100 API, 47 SPA), gates de isolamento, de escopo e de contraste | `apps/api/test`, `apps/web/src/test` |
| **E8 — Documentação** | README, arquitetura, segurança, contrato da API, design system, ADRs, harness `.claude` | `docs/`, `.claude/` |

## Próximos passos (backlog)

Ver [`backlog/mvp.md`](backlog/mvp.md) § Evolução.

## Notas — decisões travadas

Não reabrir sem motivo novo (registradas em [`decisoes/`](decisoes/)):

- PostgreSQL 17, Redis para sessão; **sem JWT** (ADR 0002).
- Auditoria na **mesma transação** da mudança de estado; falha de auditoria derruba a operação (ADR 0003).
- **Biometria só no navegador**; o servidor não recebe nem guarda imagem ou áudio (ADR 0004).
- **Ed25519** sobre JSON canônico; chave obrigatória no ambiente em produção (ADR 0005).
- Isolamento por **extensão do Prisma** com lista explícita de models (ADR 0006).
- Sem rastreador externo: o estado das tarefas vive em `tasks/prd-<slug>/tasks.md`.
