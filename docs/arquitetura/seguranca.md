# Segurança — modelo de ameaças

> Para cada ameaça: o que ela é, como o LetsSign se defende e **onde** isso está no código.
> Se uma defesa listada aqui deixar de existir, este documento está mentindo — atualize junto.

---

## 1. Vazamento entre organizações (tenancy)

**Ameaça:** um usuário da organização B vê, altera ou descobre a existência de documentos da A.
É o risco mais grave de um sistema multiempresa, e o mais silencioso: a query devolve dados a mais e
ninguém percebe.

**Defesa, em camadas:**

1. **Contexto por requisição** — o middleware de sessão abre um `AsyncLocalStorage` com a organização
   do usuário **antes** de qualquer controller (`common/auth/sessao.middleware.ts`,
   `common/tenancy/tenant-context.ts`). Nunca variável de módulo: em Node, requisições concorrentes a
   compartilhariam.
2. **Filtro automático** — uma extensão do Prisma injeta `WHERE organizacao_id = ?` em toda query dos
   models de negócio e preenche o campo na criação (`common/tenancy/tenant-extension.ts`). Quem escreve a
   query não precisa lembrar.
3. **Uma porta só para o banco** — o client cru do Prisma é privado; só existe `prisma.db`, já escopado.
4. **Escape hatch explícito** — `semEscopoDeOrganizacao()` só nos pontos legítimos (login, token de
   assinatura, validação pública, jobs), fácil de auditar num `grep`.
5. **404, não 403** — recurso de outra organização responde "não encontrado": 403 confirmaria que existe.

**Gates de teste:** `test/isolamento.integration.spec.ts` (todas as rotas de documento, equipe, auditoria,
painel) e `common/tenancy/tenancy.spec.ts`, que **falha se um model com `organizacaoId` não estiver na lista
de escopados**.

⚠️ Escritas aninhadas do Prisma não passam pela extensão — nelas o `organizacaoId` é explícito.

---

## 2. Assinatura forjada ou documento adulterado

**Ameaça:** alguém altera o PDF depois de assinado, ou fabrica uma assinatura.

**Defesa:**

- **SHA-256 do original no upload**, antes de qualquer outra coisa; o finalizador recusa selar se o arquivo
  no disco não bater com o hash registrado.
- **Assinatura Ed25519 por signatário** sobre uma carga **JSON canônica** (chaves ordenadas) que contém o
  hash do original, a identidade e as verificações (`common/cripto/assinador-ed25519.ts`,
  `common/cripto/canonico.ts`). Canônica porque assinatura cobre bytes, não objetos.
- **Selo de conclusão** sobre o hash do PDF final.
- **Validação pública recalcula tudo na hora** — nenhuma flag "válido" guardada no banco.
- **Evidências embutidas no PDF** (`letssign-evidencias.json`): o arquivo se verifica sem o LetsSign.

## 3. Trilha de auditoria adulterada

**Ameaça:** alguém com acesso ao banco "corrige" um registro — apaga a recusa, muda um horário.

**Defesa:** cada evento guarda `hashAnterior` e `hash = SHA-256(anterior + conteúdo canônico)`
(`common/auditoria/cadeia.ts`). Editar um evento quebra o próprio hash; recalculá-lo quebra o elo do
seguinte; apagar deixa um buraco na sequência. Escritas concorrentes na mesma cadeia são serializadas por
`pg_advisory_xact_lock`, e `@@unique([cadeia, sequencia])` é a rede de segurança.

A auditoria de negócio é escrita **na mesma transação** da mudança de estado (ADR 0003).

**Teste:** `assinatura.integration.spec.ts` altera um evento direto no SQL e confere que a validação
pública acusa.

## 4. Assinar no lugar de outra pessoa

**Ameaça:** alguém obtém o link de convite (e-mail encaminhado) e assina.

**Defesa:**

- **Token de 256 bits**, só o hash no banco; rotacionado a cada reenvio; invalidado ao cancelar, recusar ou
  expirar.
- **Código por e-mail obrigatório em todos os níveis** e **primeiro**: prova a posse da caixa de e-mail.
- **Ordem forçada no servidor**: não dá para iniciar a biometria sem o e-mail confirmado.
- **Desafios sorteados no servidor** (palavras, gestos, ações de prova de vida) com validade de minutos e
  limite de tentativas.
- Verificações aprovadas valem 30 minutos para concluir a assinatura.

⚠️ **Limite honesto:** a análise biométrica roda no navegador (é o que mantém a biometria fora do servidor).
Um atacante técnico poderia forjar a *resposta* do navegador. As camadas acima reduzem esse risco; um
produto em produção somaria um provedor de *liveness* com atestação no servidor (ADR 0004).

## 5. Roubo de sessão (XSS, CSRF)

- Sessão **server-side** no Redis; o cookie é `httpOnly` (JavaScript não lê), `SameSite=Lax` e `Secure` em
  produção. Não há token no `localStorage`.
- **CSRF:** além do `SameSite`, mutação com `Origin` fora da lista do CORS é recusada
  (`common/auth/origem.middleware.ts`).
- **CSP** da API sem `unsafe-inline`/`unsafe-eval`; React escapa por padrão; e-mails escapam todo texto de
  usuário (`common/email/modelos.ts`).
- Revogar sessão (tela "Sessões", desativar membro, trocar senha) derruba no Redis — efetivo na próxima
  requisição.

## 6. Força bruta e enumeração de contas

- Limite **por e-mail + IP** no login (5 tentativas, 15 min de bloqueio) além do rate limit global por IP.
- Mensagem **ambígua** ("e-mail ou senha inválidos") e **tempo constante**: e-mail inexistente confere
  contra um hash fantasma, para a resposta não ser mais rápida.
- "Esqueci a senha" responde igual exista ou não a conta.
- Senhas com **scrypt** (N=2¹⁶, ~64 MiB por tentativa), parâmetros guardados no hash.
- **MFA TOTP** opcional, por sessão, com 8 códigos de recuperação de uso único; segredo cifrado.

## 7. Mass assignment e entrada maliciosa

- `ValidationPipe` com `whitelist` + `forbidNonWhitelisted`: campo não declarado é **recusado** — não dá para
  mandar `organizacaoId`, `papel` ou `status` num payload.
- PDF validado pela **assinatura mágica** e pelo parser, não pela extensão; PDF protegido por senha
  recusado; limite de tamanho e de páginas.
- Querystring validada; no SPA, valor inválido na URL cai no padrão.
- Exportação CSV neutraliza prefixos de fórmula (`=`, `+`, `-`, `@`) contra *CSV injection*.

## 8. IDOR em arquivos

PDFs ficam em disco **privado**, sem URL pública. A leitura exige sessão, passa pelo filtro de organização
**e** confere que a chave do arquivo começa com `org-{id}/` — duas camadas. A resolução do caminho recusa
*path traversal*.

## 9. Dados pessoais e logs

- CPF cifrado (AES-256-GCM, autenticada); só os 2 últimos dígitos em claro para exibição.
- Página pública mostra e-mail, CPF e nomes **mascarados**.
- Logs com redação por nome de campo **em qualquer profundidade** (senha, token, código, CPF, cookie…).
- Biometria nunca sai do navegador (ADR 0004).

## 10. Open redirect

`?voltar=` no login só aceita caminho interno (`lib/navegacao.ts`) — `https://…`, `//…` e `/\…` caem no padrão.
