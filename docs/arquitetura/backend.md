# Arquitetura — Backend (`apps/api`)

> **Leia antes de escrever código.** Este documento manda nas convenções da API; o
> `.claude/stack-profile.md` manda nos comandos.

## Natureza

Escrita de trabalho sobre dado com **valor jurídico**: cada assinatura precisa ser provável anos depois.
Volume baixo, mas correção e rastreabilidade valem muito mais que throughput.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | NestJS 11 + Express | Módulos por domínio, DI, guards e middlewares — a estrutura que um sistema corporativo pede |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Schema declarativo, migrations versionadas e **Client Extensions** (o filtro de organização) |
| Banco | PostgreSQL 17 | Transações, `advisory locks` (cadeia de auditoria), enums nativos, JSONB |
| Sessão / fila | Redis + BullMQ | Sessão revogável, contador de tentativas, fila de e-mail com retentativa |
| Validação | zod (ambiente) + class-validator (DTO) | Ambiente validado no boot; payload validado e **restrito** na borda |
| Log | nestjs-pino | JSON estruturado com redação profunda |
| Cripto | `node:crypto` | Ed25519, AES-256-GCM, scrypt e SHA-256 nativos — nenhuma dependência nativa para compilar |
| PDF | pdf-lib + qrcode | Carimbo, manifesto, QR e anexo de evidências sem serviço externo |

## Estrutura

```
src/
  config/          env (zod, validado no boot) · database (Prisma) · logger (pino) · redis
  common/
    tenancy/       contexto por requisição, extensão do Prisma, escape hatch, lista de escopados
    auth/          sessão, middleware, guard, decorators, permissões, MFA, limite de tentativas, CSRF
    auditoria/     o serviço único de escrita e a cadeia de hash
    cripto/        JSON canônico, SHA-256, AES-GCM, scrypt, Ed25519 e a chave da plataforma
    assinaturas/   máquina de estados, convites, PDF final e o finalizador
    email/         fila BullMQ e modelos HTML
    armazenamento/ disco privado dos PDFs
    notificacoes/  sino in-app
    filters/       envelope único de erro
  modules/         autenticacao · me · documentos · assinatura · validacao · painel · equipe · auditoria
                   · organizacao · tarefas
  saude/           liveness e readiness
```

### Regras de organização

- **Controller → Service → Prisma.** Controller não tem regra de negócio; service não conhece HTTP além das exceções do Nest.
- **Módulo não importa de módulo irmão** — garantido pelo ESLint. O que dois precisam sobe para `common/`.
- **Nenhum módulo lê `process.env`** — só `config/env/`, também garantido pelo ESLint.
- **Resposta montada campo a campo** (`modules/documentos/apresentacao.ts`): nunca serializar o registro do
  Prisma direto — uma coluna nova vazaria sem ninguém perceber.

## Multi-tenancy

Ver [`seguranca.md` §1](seguranca.md#1-vazamento-entre-organizações-tenancy). Resumo operacional:

- Model novo com `organizacaoId` → **adicione a `common/tenancy/models-escopados.ts`**. O teste
  `tenancy.spec.ts` falha se esquecer.
- Criação sem `organizacaoId` → use `comOrganizacaoDoContexto<...>()`: deixa explícito que a extensão preenche.
- Escrita aninhada (`create: { filhos: { create } }`) → informe `organizacaoId` à mão; a extensão não intercepta.
- Job agendado → busque sem escopo e **entre no contexto por iteração** (`modules/tarefas/`).

## Autenticação e autorização

- **Fechado por padrão**: toda rota exige sessão; `@Publico()` abre. Esquecer produz 401, não rota aberta.
- **Permissão, não papel**: `@ExigePermissao('equipe.gerenciar')`. O papel é só um pacote de permissões
  (`common/auth/permissoes.ts`).
- **MFA por sessão**: login de quem tem MFA cria sessão "pendente"; toda rota responde **403
  `MFA_NECESSARIO`** até o código ser confirmado — 403 e não 401, para o SPA não entrar em laço de login.
- **Visibilidade de documentos**: `documentos.ver_todos` vê a organização toda; sem ela, só o que criou ou
  em que é signatário. Recurso fora da visibilidade → 404.

## Fluxo do documento

```
rascunho ──enviar──▶ em_andamento ──última assinatura──▶ concluido
                         ├── recusa ─────────────────▶ recusado
                         ├── prazo vencido (job) ────▶ expirado
                         └── cancelar ───────────────▶ cancelado
```

Tabela em `common/assinaturas/status-do-documento.ts`; transição fora dela é 422.

**Conclusão** (`common/assinaturas/finalizador-de-documento.service.ts`) é **idempotente**: roda quando a
última assinatura chega e também por um job a cada 5 minutos (se o servidor caiu no meio). Cada tentativa
grava numa chave própria e só a que vence o `updateMany … WHERE status = 'em_andamento'` fica — sem isso o
arquivo no disco e o hash no banco poderiam ser de tentativas diferentes.

## Verificação de identidade

| Nível | Etapas (nesta ordem) |
|---|---|
| simples | código por e-mail |
| biometrico | código por e-mail → rosto com prova de vida |
| completo | código por e-mail → rosto → voz → gestos |

O servidor sorteia o desafio (`modules/assinatura/desafios.ts`), guarda com validade, e avalia a resposta
com funções puras e testadas. Aprovação vale 30 min para concluir a assinatura.

## Auditoria

- **Um único serviço escreve** (`AuditoriaService.registrar`); sem caminho de edição ou exclusão.
- **Encadeada por hash**, uma cadeia por documento (`documento:<uuid>`) e uma por organização.
- **Na mesma transação** da mudança de estado — a trilha é evidência (ADR 0003).
- IP e user agent ficam **fora** do hash: anonimizá-los (LGPD) não pode quebrar a prova.

## E-mail

Fila BullMQ com 5 tentativas e recuo exponencial. Consumidor no mesmo processo por padrão
(`WORKER_EMBUTIDO`). Em teste, os e-mails vão para uma caixa em memória (`EmailService.caixaDeTeste`).

## Checklist antes de submeter

- [ ] `npm run lint`, `npm run typecheck` e `npm run test` passam.
- [ ] Query nova escopada pela organização — ou escape hatch com justificativa.
- [ ] Teste provando que outra organização não alcança o dado novo.
- [ ] Mutação audita, na mesma transação.
- [ ] Rota com a permissão certa; nada decidido só no front.
- [ ] DTO declara todos os campos.
- [ ] Endpoint novo em [`api-contract.md`](api-contract.md).
- [ ] Nada sensível no log; nada de `any` ou `console`.
