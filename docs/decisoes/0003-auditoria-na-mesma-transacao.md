# 0003 — Auditoria encadeada por hash, na mesma transação

**Estado:** aceita · 2026-09-24

## Contexto

Num sistema interno comum, se a auditoria falhar a operação pode seguir (disponibilidade pesa mais). No
LetsSign a trilha é **evidência jurídica**: uma assinatura registrada sem o evento que a prova é uma
assinatura sem prova. E quem tem acesso ao banco não pode poder "corrigir" o passado sem deixar rastro.

## Decisão

1. **Append-only por desenho:** um único serviço escreve (`AuditoriaService`), sem método de edição ou
   exclusão; a tabela não tem `atualizadoEm`.
2. **Encadeamento:** cada evento guarda `hashAnterior` e
   `hash = SHA-256(hashAnterior + "\n" + JSON canônico do conteúdo)`. Uma cadeia por documento e uma por
   organização.
3. **Mesma transação:** eventos de negócio são escritos dentro da transação da mudança de estado — ou os dois
   acontecem, ou nenhum. **Falha de auditoria derruba a operação.**
4. **Concorrência:** `pg_advisory_xact_lock(hashtext(cadeia))` serializa a cadeia; `@@unique([cadeia, sequencia])`
   é a rede de segurança.
5. **IP e user agent fora do hash:** anonimizá-los (LGPD) não pode quebrar a prova do que foi feito.

## Consequências

- ✅ Qualquer edição, exclusão ou inserção fora de ordem é detectada (validação pública e "Examinar integridade").
- ✅ Testado de ponta a ponta: o teste altera um evento direto no SQL e a validação acusa.
- ⚠️ Não impede que alguém com acesso total **reescreva a cadeia inteira**. Para isso, a evolução natural é
  ancorar periodicamente o último hash fora do sistema (e-mail, carimbo de tempo RFC 3161 ou blockchain pública).
