# 0005 — Ed25519 sobre JSON canônico, com evidências no PDF

**Estado:** aceita · 2026-09-24

## Contexto

A assinatura precisa ser verificável por terceiros, anos depois, inclusive sem o LetsSign no ar.

## Decisão

- **Ed25519** (RFC 8032) com a chave da plataforma: determinístico (não depende de bom aleatório na hora de
  assinar — a falha clássica do ECDSA), chaves de 32 bytes, suportado em qualquer biblioteca séria e no
  `node:crypto`, sem dependência nativa.
- Cada signatário gera uma **carga** com o hash SHA-256 do original, uuid do documento, identidade (CPF só
  como hash salgado), instante, IP, verificações aprovadas e a manifestação de vontade. A carga é
  serializada em **JSON canônico** (chaves ordenadas) — assinatura cobre bytes, e sem forma canônica outro
  serializador produziria outros bytes.
- Na conclusão, um **selo** assina o hash do PDF final e as assinaturas.
- O PDF final **embute** `letssign-evidencias.json` (cargas, assinaturas e chave pública) e mostra o id da chave.
- A chave pública fica em `GET /api/publico/chave`. Em produção a privada é **obrigatória** no ambiente
  (`CHAVE_PRIVADA_ED25519`); em desenvolvimento é gerada em `storage/chaves/`.

## Consequências

- ✅ O arquivo se autoverifica: `Ed25519.verify(chave, UTF-8(carga), base64(assinatura))`.
- ✅ A validação pública recalcula tudo na hora.
- ⚠️ Não é assinatura qualificada ICP-Brasil (exigiria certificado do signatário). O documento é
  **assinatura eletrônica avançada** (Lei 14.063/2020), o que o README deixa explícito.
- ⚠️ Trocar a chave da plataforma exige manter a antiga para verificar o legado (rotação com `idDaChave`).
