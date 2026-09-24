# Contrato da API

> Prefixo `/api`. Sessão por cookie `httpOnly` (`letssign_sessao`). **Atualize este arquivo na mesma
> passada em que criar ou alterar um endpoint.**
>
> Legenda — **Acesso:** 🌐 público · 🔑 sessão · 🔑+`permissão`. Rotas com sessão exigem o MFA confirmado
> quando a conta tem MFA ativo (senão **403 `MFA_NECESSARIO`**).

## Envelope de erro

Toda falha sai assim (campos extras podem aparecer, como `error: "MFA_NECESSARIO"`):

```json
{ "statusCode": 422, "message": "Depois de enviado, o documento não pode mais ser alterado.", "error": "Unprocessable Entity", "path": "/api/documentos/…", "timestamp": "2026-09-24T12:00:00.000Z" }
```

`400` validação (mensagens em pt-BR; campo não declarado → `O campo "x" não é permitido.`) · `401` sem sessão
· `403` sem permissão, origem inválida ou MFA pendente · `404` inexistente **ou de outra organização** ·
`410` documento que não aceita mais assinatura · `422` regra de negócio · `429` limite de tentativas.

---

## Saúde

| Método | Rota | Acesso | Resposta |
|---|---|---|---|
| GET | `/saude` | 🌐 | `{ status: "ok" }` — processo vivo |
| GET | `/saude/pronto` | 🌐 | `{ status, detalhes: { banco, redis } }` — 503 se algo caiu |

## Autenticação

| Método | Rota | Acesso | Corpo | Resposta |
|---|---|---|---|---|
| POST | `/auth/cadastro` | 🌐 | `{ nomeOrganizacao, nome, email, senha, plano? }` | 201 `{ precisaMfa }` + cookie |
| POST | `/auth/entrar` | 🌐 | `{ email, senha }` | 200 `{ precisaMfa }` + cookie · 401 ambíguo · 429 após 5 erros |
| POST | `/auth/mfa` | 🔑 (sessão pendente) | `{ codigo }` (6 dígitos ou `XXXX-XXXX`) | 204 |
| POST | `/auth/sair` | 🌐 | — | 204, apaga o cookie e a sessão |
| POST | `/auth/esqueci-senha` | 🌐 | `{ email }` | 202 (sempre — não revela se a conta existe) |
| POST | `/auth/redefinir-senha` | 🌐 | `{ token, senha }` | 204 · 422 link usado/expirado (serve também ao convite de equipe) |

## Eu (`/me`)

| Método | Rota | Acesso | Corpo / Resposta |
|---|---|---|---|
| GET | `/me` | 🔑 | `{ uuid, nome, email, papel, permissoes[], mfaAtivo, organizacao: { uuid, nome, plano } }` |
| PATCH | `/me` | 🔑 | `{ nome }` → 204 |
| POST | `/me/senha` | 🔑 | `{ senhaAtual, novaSenha }` → 204 (encerra as outras sessões) |
| POST | `/me/mfa/iniciar` | 🔑 | → `{ qrCode, segredo }` (segredo fica na sessão até confirmar) |
| POST | `/me/mfa/confirmar` | 🔑 | `{ codigo }` → `{ codigosDeRecuperacao[8] }` (única vez em que aparecem) |
| POST | `/me/mfa/desativar` | 🔑 | `{ senha }` → 204 |
| GET | `/me/sessoes` | 🔑 | `[{ uuid, ip, userAgent, criadaEm, ultimaAtividadeEm, atual }]` |
| DELETE | `/me/sessoes/:uuid` | 🔑 | 204 |
| GET | `/me/notificacoes` | 🔑 | `{ naoLidas, itens[] }` |
| POST | `/me/notificacoes/lidas` | 🔑 | 204 |

## Documentos

Visibilidade: com `documentos.ver_todos`, a organização inteira; sem, só os que criou ou em que é signatário.

| Método | Rota | Acesso | Corpo / Resposta |
|---|---|---|---|
| GET | `/documentos?q&status&ordenar&dir&pagina&por` | 🔑 | `{ itens[], total, pagina, porPagina, contagens }` — `ordenar`: `criadoEm·atualizadoEm·titulo·prazo` |
| POST | `/documentos` | 🔑+`documentos.criar` | multipart `arquivo` (PDF ≤ 20 MB) + `titulo`, `mensagem?` → 201 detalhe (rascunho) |
| GET | `/documentos/:uuid` | 🔑 | detalhe com signatários, verificações e `podeGerenciar`, `meuSignatario` |
| PATCH | `/documentos/:uuid` | 🔑 (dono ou `gerenciar_todos`) | `{ titulo?, mensagem?, nivelVerificacao?, ordemSequencial?, prazo? }` — só rascunho |
| DELETE | `/documentos/:uuid` | 🔑 (dono) | 204 — só rascunho |
| PUT | `/documentos/:uuid/signatarios` | 🔑 (dono) | `{ signatarios: [{ nome, email, cpf? }] }` (1–20; a ordem é a de assinatura) |
| POST | `/documentos/:uuid/enviar` | 🔑 (dono) | 200 detalhe · 422 sem signatário ou cota do plano esgotada |
| POST | `/documentos/:uuid/cancelar` | 🔑 (dono) | `{ motivo }` (5–500) — invalida os links |
| POST | `/documentos/:uuid/signatarios/:signatario/reenviar` | 🔑 (dono) | `{ link }` — rotaciona o token |
| POST | `/documentos/:uuid/assinar-agora` | 🔑 | `{ caminho }` quando a pessoa logada é signatária e é a vez dela |
| GET | `/documentos/:uuid/trilha` | 🔑 | `{ integridade, eventos[] }` |
| GET | `/documentos/:uuid/arquivo?versao=original\|assinado&baixar=1` | 🔑 | `application/pdf`, `no-store` |

## Assinatura (quem assina, sem conta)

O `:token` do link é a credencial (256 bits; só o hash no banco).

| Método | Rota | Corpo / Resposta |
|---|---|---|
| GET | `/assinatura/:token` | sessão: documento, signatário, `ehSuaVez`, verificações exigidas, participantes (nomes abreviados) |
| GET | `/assinatura/:token/arquivo?versao&baixar` | PDF |
| POST | `/assinatura/:token/verificacoes/codigo_email/iniciar` | `{ desafio, expiraEm, enviadoPara }` — código de 6 dígitos por e-mail, 10 min |
| POST | `/assinatura/:token/verificacoes/codigo_email/concluir` | `{ desafio, codigo }` |
| POST | `/assinatura/:token/verificacoes/facial/iniciar` | `{ desafio, expiraEm, acoes[2] }` — `piscar · virar_esquerda · virar_direita` |
| POST | `/assinatura/:token/verificacoes/facial/concluir` | `{ desafio, medicao: { acoes, quadrosAnalisados, quadrosComRosto, confiancaMedia, rostosMultiplos } }` |
| POST | `/assinatura/:token/verificacoes/voz/iniciar` | `{ desafio, expiraEm, palavras[3] }` |
| POST | `/assinatura/:token/verificacoes/voz/concluir` | `{ desafio, transcricao }` |
| POST | `/assinatura/:token/verificacoes/gestos/iniciar` | `{ desafio, expiraEm, sequencia[3] }` — `Open_Palm · Closed_Fist · Pointing_Up · Thumb_Up · Victory` |
| POST | `/assinatura/:token/verificacoes/gestos/concluir` | `{ desafio, gestos[], confiancas[] }` |
| POST | `/assinatura/:token/assinar` | `{ tipo: desenhada\|digitada, imagem: data:image/png;base64, aceite: true, cpf? }` → `{ concluido }` |
| POST | `/assinatura/:token/recusar` | `{ motivo }` → 204, encerra o documento |

Verificações seguem a ordem do nível; pular dá 422. Conclusão reprovada dá 422 com o motivo; 5 tentativas por desafio.

## Validação pública

| Método | Rota | Resposta |
|---|---|---|
| GET | `/publico/validar/:codigo` | documento, `selo { valido }`, `trilha { integra, total, quebraEm, motivo }`, signatários mascarados com `assinaturaDigital { valida }`, linha do tempo |
| GET | `/publico/validar/hash/:sha256` | `{ codigo, versao: original\|assinado }` · 404 se não corresponde |
| GET | `/publico/chave` | `{ algoritmo: "Ed25519", id, pem }` |

## Gestão

| Método | Rota | Acesso | Corpo / Resposta |
|---|---|---|---|
| GET | `/painel` | 🔑 | indicadores, `porStatus`, `serieMensal[12]`, `verificacoes`, `cota`, `aguardandoVoce`, `atividade` |
| GET | `/equipe` | 🔑+`equipe.ver` | membros |
| POST | `/equipe` | 🔑+`equipe.gerenciar` | `{ nome, email, papel }` → convite por e-mail (72 h) |
| PATCH | `/equipe/:uuid` | 🔑+`equipe.gerenciar` | `{ papel?, ativo? }` — não a si mesmo; nunca sem proprietário ativo |
| POST | `/equipe/:uuid/reenviar-convite` | 🔑+`equipe.gerenciar` | 204 |
| GET | `/auditoria?acao&tipoAtor&q&pagina&por` | 🔑+`auditoria.ver` | `{ itens[], total, acoes[] }` |
| GET | `/auditoria/integridade` | 🔑+`auditoria.ver` | `{ cadeias, eventos, integra, quebradas[] }` |
| GET | `/auditoria/exportar` | 🔑+`auditoria.ver` | `text/csv` (proteção contra CSV injection) |
| GET | `/organizacao` | 🔑 | `{ nome, plano, uso: { enviadosNoMes, limiteDeEnvios, membros, limiteDeMembros } }` |
| PATCH | `/organizacao` | 🔑+`organizacao.gerenciar` | `{ nome?, plano? }` (troca de plano simulada) |
