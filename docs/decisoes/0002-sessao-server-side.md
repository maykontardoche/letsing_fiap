# 0002 — Sessão server-side em Redis, não JWT

**Estado:** aceita · 2026-09-24

## Contexto

O produto precisa **revogar** acesso na hora: desativar um membro, encerrar uma sessão suspeita na tela
"Sessões ativas", derrubar tudo ao trocar a senha. E um token guardado pelo JavaScript é alcançável por XSS.

## Decisão

- Sessão guardada no **Redis** com TTL deslizante de 8 h; o navegador guarda só um id aleatório de 256 bits
  num cookie **`httpOnly`, `SameSite=Lax`, `Secure` em produção**.
- Tabela `sessoes` com o **metadado** (IP, navegador, horários) e o **hash** do id — o id em si é credencial
  e nunca vai para o banco.
- MFA **por sessão**: o flag de "segundo fator confirmado" vive na sessão; cada login pede de novo.

## Alternativas descartadas

- **JWT sem estado:** revogar exigiria uma lista de bloqueio consultada a cada requisição — o mesmo Redis
  com mais passos e mais formas de errar. Token no `localStorage` exporia a sessão a XSS.

## Consequências

- ✅ Revogação efetiva na próxima requisição; XSS não lê a sessão.
- ✅ CSRF mitigado por `SameSite` + checagem de `Origin` nas mutações.
- ⚠️ Redis vira dependência de disponibilidade (coberto pelo `/api/saude/pronto`).
