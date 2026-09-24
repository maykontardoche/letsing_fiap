# Code Quality Checklist

| Aspect | Verification |
|--------|-------------|
| Complexity | Functions not too long, low cyclomatic complexity |
| DRY | No duplicated code |
| SOLID | SOLID principles followed |
| Naming | Clear and descriptive names |
| Comments | Comments only where necessary (explain *why*, never *what*) |
| Error Handling | Adequate error handling |
| Security | No obvious vulnerabilities (SQL injection, XSS, etc.) |
| Performance | No obvious performance issues |

## LetsSign — regras do projeto

Detalhes em `.claude/stack-profile.md`. Violação de qualquer item marcado **(bloqueante)**
reprova o review.

### `apps/api`

| Regra | Verificação |
|-------|-------------|
| Isolamento por organização **(bloqueante)** | Model novo com `organizacaoId` está em `apps/api/src/common/tenancy/models-escopados.ts`; rota de negócio nova tem caso em `test/isolamento.integration.spec.ts`; `semEscopoDeOrganizacao()` só onde é legítimo e justificado; job fora do HTTP usa `executarNoContexto` por iteração |
| Auditoria **(bloqueante)** | Toda mutação de negócio chama `AuditoriaService.registrar(..., tx)` na **mesma transação**; nenhum update/delete de evento de auditoria |
| Rotas fechadas **(bloqueante)** | Rota nova exige sessão, ou tem `@Publico()` consciente; autorização por `@ExigePermissao`, nunca por papel nem só no cliente |
| DTOs | Todo corpo validado por DTO (campo não declarado é rejeitado); mensagens em pt-BR |
| Configuração | Nenhum `process.env` fora de `apps/api/src/config/env/`; variável nova no `env.schema.ts` e no `.env.example` |
| Fronteira de módulos | Nenhum import de módulo irmão; módulo novo incluído na lista `MODULOS` do `eslint.config.mjs` |
| Logs | Nada sensível em log (senha, token, código, CPF, segredo de MFA, chave); campo sensível novo em `CAMPOS_SENSIVEIS` |
| Criptografia | Hash, assinatura e cifra pelo que já existe em `src/common/cripto/`; nada caseiro |

### `apps/web`

| Regra | Verificação |
|-------|-------------|
| Privacidade **(bloqueante)** | Nenhum dado biométrico (imagem, áudio, vídeo) enviado à API ou gravado; nada sensível em `localStorage`/`sessionStorage` |
| 4 estados | Carregando, erro (com tentar de novo), vazio e conteúdo em toda tela que busca dados |
| Filtros na URL | Filtro, busca, ordenação e página via `useFiltrosNaUrl`; valor inválido cai no padrão |
| Ações destrutivas | `useConfirmacao()`, nunca `confirm()` nativo |
| Status | Nunca só por cor — cor, ícone e rótulo |
| Tema e tokens | Só tokens semânticos de `src/styles/tokens.css`; nenhuma cor hexadecimal solta; claro e escuro funcionam |
| Acessibilidade | WCAG 2.2 AA: contraste ≥ 4.5:1 (teste em `src/test/contratos.test.ts`), foco visível, rótulos associados, modal prende foco e fecha com `Esc` |
| API | Toda chamada passa por `src/lib/http.ts` |

### Ambos

| Regra | Verificação |
|-------|-------------|
| Proibidos **(bloqueante)** | Nenhum `any`, `console.log`, `@ts-ignore` |
| Idioma | Docs e UI em pt-BR; identificadores de domínio em português |
