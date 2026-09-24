# Stack Profile: LetsSign — monorepo (API + SPA)

Stack: TypeScript em toda a linha. **NestJS 11 + Prisma 7 + PostgreSQL 17 + Redis (BullMQ)**
na API, **React 19 + Vite 7 + Tailwind 4** no SPA, **npm workspaces** como gerenciador.

Este é o profile que as skills do core leem em `.claude/stack-profile.md`. É **um arquivo só
para o monorepo inteiro**: as seções marcadas `apps/api` ou `apps/web` valem para a app onde
o código da tarefa é escrito.

**LetsSign** é uma plataforma de assinatura eletrônica com verificação biométrica de
identidade (código por e-mail, prova de vida facial, desafio de voz e gestos de mão, tudo no
navegador), assinatura da plataforma em Ed25519, integridade por SHA-256, trilha de auditoria
append-only encadeada por hash, multi-tenant por organização e página pública de validação.
Projeto acadêmico da FIAP.

## Projects

Um **único repositório git**, com as duas apps e a documentação lado a lado:

| Diretório | Tipo | Papel |
|-----------|------|-------|
| `apps/api/` | NestJS 11 + Prisma 7 | API REST multi-tenant, prefixo `/api` |
| `apps/web/` | React 19 + Vite 7 | SPA (área logada, fluxo de assinatura, validação pública) |
| `docs/` | Markdown | Documentação do projeto, `docs/status.md`, decisões em `docs/decisoes/` |
| `tasks/` | Markdown | Artefatos de spec: `tasks/prd-<slug>/` |

⚠️ **Caminhos se escrevem a partir da raiz do repositório** (`apps/api/src/...`,
`docs/status.md`, `tasks/prd-<slug>/`). As skills rodam com o cwd na raiz; contar `..` a
partir do arquivo dá errado.

⚠️ **Os comandos de cada app rodam a partir do diretório dela** (`apps/api` ou `apps/web`).
Alternativa equivalente da raiz: `npm run <script> -w apps/api`.

## Rastreamento — sem rastreador externo

⚠️ **Este projeto não usa Linear nem nenhum rastreador externo.** O estado do trabalho vive
no repositório:

| O quê | Onde |
|---|---|
| Estado da tarefa | `tasks/prd-<slug>/tasks.md` |
| O que foi feito | `## Log de execução` no `[num]_task.md` |
| Estado do épico | `docs/status.md`, no fechamento do épico |
| Projeto de destino e dependências | `tasks.md`, declarados por tarefa |

O **projeto de destino** de uma tarefa é `apps/api`, `apps/web` ou `docs`, definido por
**onde o código é escrito**, não por quem pediu a funcionalidade. Tarefa que toca as duas apps
é **quebrada em duas**, com a dependência declarada entre elas.

## Commands

⚠️ Os comandos abaixo são **os reais**, guardados por teste
(`apps/api/src/stack-profile.spec.ts`): todo `npm run <script>` citado aqui precisa existir no
`package.json` correspondente, ou a suíte quebra. Corrija sempre **aqui**, nunca nas skills.

### Raiz do repositório
- `setup`: `npm run setup` (sobe a infraestrutura, aplica as migrations e roda o seed)
- `infra`: `npm run infra:up` (Postgres, Redis e Mailpit via `docker compose`) · `npm run infra:down`
- `dev`: `npm run dev` (API e SPA juntos)
- `verificar`: `npm run verificar` (lint + typecheck + test nas duas apps) — **gate final**

### `apps/api` (rodar a partir de `apps/api`)
- `test`: `npm run test` (Jest; unidade `*.spec.ts` e integração `test/*.integration.spec.ts` na mesma suíte)
- `test:unit`: `npm run test:unit` (só unidade — não precisa de infraestrutura)
- `typecheck`: `npm run typecheck` (`tsc --noEmit`)
- `lint`: `npm run lint` (`lint:fix` corrige)
- `dev`: `npm run dev` (porta **3020**, base `http://localhost:3020/api`)
- `build`: `npm run build`
- Banco: `npm run db:migrate` · `npm run db:migrate:dev` · `npm run db:seed` · `npm run db:reset` · `npm run db:studio`
- `e2e`: não há script separado — a verificação ponta a ponta da API são os testes de
  integração, que já rodam no `test`.

⚠️ **Os testes de integração precisam da infraestrutura no ar:** `docker compose up -d` na
raiz (ou o script `infra:up` da raiz) sobe Postgres (**5452**), Redis (**6392**) e Mailpit (SMTP
**1035**, caixa de entrada em **http://localhost:8035**). As portas fogem do padrão de
propósito; sobrescreva com `POSTGRES_PORT`, `REDIS_PORT`, `MAILPIT_SMTP_PORT`,
`MAILPIT_UI_PORT` e `PORT`. A integração roda em série (`maxWorkers: 1`) contra banco de teste
próprio, criado no `globalSetup`.

### `apps/web` (rodar a partir de `apps/web`)
- `test`: `npm run test` (Vitest; `test:watch` em modo observação)
- `typecheck`: `npm run typecheck` (`tsc -b --noEmit`)
- `lint`: `npm run lint` (`lint:fix` corrige)
- `dev`: `npm run dev` (Vite, porta **5190**, `strictPort`)
- `build`: `npm run build` · `preview`: `npm run preview`
- `e2e`: não há suíte E2E versionada — ver **QA Strategy** (Playwright MCP, opcional).

Em desenvolvimento o proxy do Vite encaminha `/api` para a API na 3020, então a URL da API é
relativa — igual à de produção.

## Common Technologies

- **`apps/api`:** NestJS 11 + Express, Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 17,
  Redis (`ioredis`: sessão, limite de tentativas) + BullMQ (fila de e-mail), `@nestjs/config`
  + `zod` (ambiente validado no boot), `@nestjs/throttler`,
  `@nestjs/schedule`, `nestjs-pino`, `class-validator`/`class-transformer`, `helmet`,
  `nodemailer`, `pdf-lib`, `otplib` + `qrcode` (MFA), `multer`.
- **`apps/web`:** React 19, Vite 7, Tailwind 4, TanStack Query, React Hook Form + Zod, React
  Router 7, Vitest + Testing Library, `lucide-react`, `sonner`, `motion`, `react-pdf`,
  `react-chartjs-2`, `@mediapipe/tasks-vision` e `@vladmandic/face-api` (visão computacional
  **no navegador**).

## Arquitetura — `apps/api`

- **Controller → Service**, com o Prisma acessado pelo `PrismaService`
  (`apps/api/src/config/database/`). O controller não conhece Prisma; o service não conhece
  HTTP.
- **Módulo não importa de módulo irmão** (`src/modules/*`). O que dois precisam sobe para
  `src/common/`. Garantido pelo ESLint (`no-restricted-imports`) — um módulo novo entra na
  lista `MODULOS` do `apps/api/eslint.config.mjs`.
- **Nenhum `process.env` fora de `apps/api/src/config/env/`**. A configuração sai do
  `EnvService`, validada no boot pelo schema `zod`; o ESLint recusa o acesso direto. Variável
  nova entra no `env.schema.ts` **e** no `.env.example`.
- **A borda de segurança é uma só** (`apps/api/src/configurar-app.ts`), compartilhada pelo
  `main.ts` e pelos testes de integração: helmet com CSP estrita, CORS só para as origens do
  ambiente, prefixo `/api`, filtro global de erro com envelope único.
- **DTO rejeita campo não declarado** (`ValidationPipe` com `whitelist` +
  `forbidNonWhitelisted`) — é o que impede injetar `organizacaoId`, `status` ou `papel` num
  payload. Mensagens de validação em pt-BR.
- **Jobs agendados** (`@Cron`, em `src/modules/tarefas/`) e o consumidor da fila rodam fora do
  ciclo HTTP. O consumidor de e-mail roda no mesmo processo por padrão
  (`WORKER_EMBUTIDO=true`).

## Multi-tenancy — a regra mais séria do projeto

Toda entidade de negócio pertence a uma **organização** (`organizacaoId`). A camada própria
vive em `apps/api/src/common/tenancy/`:

1. **`tenant-context.ts`** — contexto por requisição via `AsyncLocalStorage`
   (`executarNoContexto`, `organizacaoAtual`, `exigirOrganizacaoAtual`). ⚠️ **Nunca uma
   variável de módulo mutável**: em Node uma requisição enxergaria a organização de outra.
2. **`tenant-extension.ts`** — extensão do Prisma Client que injeta `where: { organizacaoId }`
   em toda query de model escopado e preenche na criação.
3. **`semEscopoDeOrganizacao()`** — escape hatch **explícito**, para os poucos casos legítimos
   (login, cadastro, validação pública, jobs que iteram organizações). Nunca implícito.

⚠️ **Gate bloqueante:** todo model novo com `organizacaoId` **precisa** entrar em
`apps/api/src/common/tenancy/models-escopados.ts`. O `tenancy.spec.ts` compara a lista com o
`schema.prisma` e quebra a suíte se faltar algum. O isolamento entre organizações é coberto
por `apps/api/test/isolamento.integration.spec.ts` — rota de negócio nova ganha caso lá.

⚠️ Job fora do ciclo HTTP não tem contexto: todo job que itera organizações entra no contexto
**por iteração**, com `executarNoContexto`.

## Autenticação e autorização — sempre no servidor

- **Sessão server-side em Redis**, num cookie `httpOnly`. Não há token no JavaScript do SPA.
- **Rotas fechadas por padrão.** Toda rota exige sessão, exceto as marcadas com `@Publico()`
  (`apps/api/src/common/auth/decorators.ts`). Esquecer de proteger produz 401, não rota aberta.
- **Autorização por permissão, não por papel:** `@ExigePermissao('documentos.criar')`. O
  catálogo e o mapa papel → permissões vivem em `apps/api/src/common/auth/permissoes.ts`
  (papéis: `proprietario`, `administrador`, `membro`, `auditor`). Guard nunca pergunta "é
  administrador?".
- **MFA** (`@DispensaMfa()` só nas rotas do próprio fluxo de MFA e no logout) e limite de
  tentativas no login.
- Esconder botão ou rota no React **não é autorização** — é decoração. O servidor decide
  sempre.

## Auditoria — append-only, na mesma transação

- **Ponto único de escrita:** `AuditoriaService.registrar(entrada, tx)`
  (`apps/api/src/common/auditoria/`). Nenhum caminho da aplicação edita ou apaga evento — só
  cria e lê.
- **Toda mutação de negócio audita, na mesma transação** da mudança de estado: ou os dois,
  ou nenhum. Falha de auditoria **derruba** a operação — a trilha é evidência da assinatura.
  Ver `docs/decisoes/0003-auditoria-na-mesma-transacao.md`.
- Cada evento é **encadeado por hash** ao anterior da mesma cadeia (documento ou
  organização); alterar por fora é detectável.

## Assinatura, criptografia e biometria

- Assinatura da plataforma em **Ed25519** e integridade do documento por **SHA-256**
  (`apps/api/src/common/cripto/`). Nada de criptografia caseira: use o que já existe lá.
- ⚠️ **Biometria nunca sai do navegador (LGPD).** Rosto, voz e gestos são processados no SPA;
  imagem, áudio e vídeo **não** são enviados à API nem gravados. Ver
  `docs/decisoes/0004-biometria-no-navegador.md`.
- CPF e segredo de MFA são cifrados em repouso (`ENCRYPTION_KEY`).

## Frontend — `apps/web`

- **Os 4 estados de UI** em toda tela que busca dados: carregando, erro (com "tentar de
  novo"), vazio (dizendo o que fazer) e conteúdo — componentes em
  `apps/web/src/components/ui/Estados.tsx`.
- **Filtro, busca, ordenação e página na URL** (`useFiltrosNaUrl`). URL é entrada do usuário:
  valor inválido cai no padrão; mudar filtro volta para a página 1.
- **`useConfirmacao()`** em 100% das ações destrutivas — nunca `confirm()` nativo.
- **Status nunca só por cor** — cor, ícone e rótulo (`EtiquetaDeStatus`, mapas em
  `src/constants/status.ts`).
- **Tema claro/escuro via tokens semânticos** em `apps/web/src/styles/tokens.css`
  (`fundo`, `superficie`, `tinta`, `*-tinta`…; tema escuro por `[data-tema='escuro']`).
  Componente usa só a camada semântica; **nunca cor hexadecimal solta em `.tsx`**. Texto de
  status usa sempre os tons `*-tinta`.
- **Única porta de saída para a API:** `apps/web/src/lib/http.ts`. Nenhum `fetch` fora dali.
- **Nada sensível em storage do browser** (`localStorage`, `sessionStorage`, cookie legível
  por JS).
- Contratos que não passam por tipo (planos, política de senha) são guardados por
  `apps/web/src/test/contratos.test.ts`, que lê o código da API.

## QA Strategy

- **`apps/api` — tipo API.** Verificação por requisição/resposta nos testes de integração
  (`supertest` contra a aplicação real, com Postgres e Redis). Acessibilidade não se aplica.
  **Gates:** payload com campo não declarado é rejeitado · erro sai no envelope padrão e não
  vaza detalhe interno · `/api/saude/pronto` devolve 503 com banco ou Redis fora · **rota de
  negócio filtra por organização** · **rota nova é fechada ou marcada `@Publico()`
  conscientemente** · **mutação audita na mesma transação** · nada sensível no log.
- **`apps/web` — tipo web.** Testes com Vitest + Testing Library (`npm run test`). Driver de
  QA exploratório: **Playwright MCP, opcional**, contra o `dev` em http://localhost:5190 (API
  em http://localhost:3020/api). Códigos e convites enviados por e-mail chegam no Mailpit, em
  http://localhost:8035. Evidência: screenshot.
- **Acessibilidade: WCAG 2.2 AA.** **Gates:** contraste ≥ 4.5:1 nos dois temas (teste em
  `apps/web/src/test/contratos.test.ts` calcula a partir dos tokens) · foco de teclado visível
  em todo controle · modal prende foco, `Esc` fecha e devolve o foco ao gatilho · campo
  associado a rótulo · status nunca só por cor · os 4 estados presentes · tema claro e escuro
  conferidos.
- ⚠️ Etapas que exigem câmera ou microfone (prova de vida, voz, gestos) podem não ser
  executáveis no navegador do Playwright. Registre como **não verificado, com o motivo** — não
  como bug — e confira a lógica pelos testes unitários.

## Observability

- Logs JSON via `nestjs-pino`, com **redaction em qualquer profundidade**
  (`apps/api/src/config/logger/redaction.ts`): senha, token, cookie, `Authorization`, código
  de verificação, segredo e códigos de MFA, CPF, imagem de assinatura, chave privada. Campo
  sensível novo entra em `CAMPOS_SENSIVEIS`.
- **Nada sensível em log** — nem SQL com parâmetros, nem dado biométrico.
- Auditoria é **separada do log** e obrigatória (ver acima).
- Health: `/api/saude` (liveness, nunca consulta dependência) e `/api/saude/pronto`
  (readiness — banco e Redis).
- SPA: sem telemetria. ⚠️ Nunca enviar dado de usuário para serviço de terceiro sem decisão
  registrada em `docs/decisoes/`.

## Language & Naming

- Language: TypeScript (strict mode) nas duas apps.
- **Docs, UI e mensagens em português do Brasil** — inclusive mensagens de validação e de
  erro que chegam à tela.
- **Identificadores de domínio em português**, como no código existente (`organizacaoId`,
  `AuditoriaService.registrar`, `useConfirmacao`, `EtiquetaDeStatus`). Termos técnicos do
  framework ficam como o framework os chama (`controller`, `service`, `dto`, `module`,
  hooks `use*`). Comentários em pt-BR, explicando o **porquê** (decisão, armadilha), nunca o
  quê.
- Naming:
  - `camelCase` — métodos, funções, variáveis
  - `PascalCase` — classes, interfaces, tipos, componentes React
  - `kebab-case` — arquivos e diretórios da API (`auditoria.service.ts`,
    `models-escopados.ts`); no SPA, componentes e páginas em `PascalCase.tsx` (`Botao.tsx`,
    `DocumentosPage.tsx`) e o resto em `kebab-case`/`camelCase` como já está
  - `UPPER_SNAKE_CASE` — constantes (`MODELS_ESCOPADOS`, `CAMPOS_SENSIVEIS`, `PERMISSOES`)
- Type rules: `readonly` em props e entradas; tipo de retorno explícito quando a inferência
  esconderia a intenção (ex.: `Promise<void>` em handler, união de retorno); prefira
  `type`/`interface` nomeado quando a forma se repete.
- Formatação é do **Prettier** (largura 100); linhas em branco separando blocos lógicos dentro
  de uma função são aceitas.

## Forbidden (CRITICAL em review)

- `any` (o ESLint já recusa), `@ts-ignore`, `!` para calar o compilador.
- `console.log` (ou qualquer `console.*`) em código versionado — use o logger.
- `process.env` fora de `apps/api/src/config/env/`.
- Import de módulo irmão em `apps/api/src/modules/`.
- Model com `organizacaoId` fora de `models-escopados.ts`; query de negócio fora do escopo sem
  `semEscopoDeOrganizacao()` explícito e justificado.
- Mutação de negócio sem auditoria na mesma transação; qualquer update/delete de evento de
  auditoria.
- Rota aberta sem `@Publico()` consciente; autorização decidida só no cliente.
- Dado sensível em log; dado biométrico enviado ao servidor.
- `fetch` fora de `apps/web/src/lib/http.ts`; cor hexadecimal solta em componente;
  `confirm()` nativo.

## Armadilhas registradas

- **Prisma fixado em 7.10.0.** No Prisma 7 a `url` do banco vive em `apps/api/prisma.config.ts`
  e o client recebe o driver adapter `@prisma/adapter-pg`.
- **Pacote ESM-only quebra o `ts-jest`** (a API é CommonJS). Por isso `otplib` está em 12.x
  e `@nestjs/schedule` em 6.x. Antes de instalar, confira:
  `node -e "console.log(require('<pacote>/package.json').type)"` — se imprimir `module`,
  procure a última versão CommonJS em vez de mexer na configuração do Jest.
- **Suíte de integração com o `dev` da API no ar** compete por CPU com o `nest start --watch`
  e pode estourar o `beforeAll`. Antes de rodar a suíte inteira, pare o `dev` e confira que a
  porta 3020 ficou livre — no Windows, parar o wrapper do npm não mata o `node` filho.

## Stack Skills

Nenhuma registrada. Se uma skill de stack for adicionada a `.claude/skills/`, liste-a aqui —
`executar-task` lê esta seção para decidir o que carregar.
