# Backlog — LetsSign

> **Spec primária.** Épicos, conceitos centrais e o que vem depois do MVP.

## Visão

Empresas e profissionais precisam assinar documentos à distância **com prova de quem assinou**. As
alternativas comuns ou são uma imagem colada num PDF (sem prova nenhuma) ou exigem certificado digital
ICP-Brasil (caro e fora do alcance da maioria das pessoas que assinam). O LetsSign ocupa o meio:
**assinatura eletrônica avançada** com identidade comprovada por biometria e criptografia verificável por
qualquer pessoa.

## Personas

| Persona | Quem é | O que precisa |
|---|---|---|
| **Remetente** (proprietário, administrador, membro) | Quem envia contratos | Enviar rápido, acompanhar quem falta, receber o PDF final |
| **Signatário** | Cliente, fornecedor, colaborador — **sem conta** | Assinar pelo celular em minutos, com segurança |
| **Auditor** | Jurídico, compliance | Ler tudo, provar integridade, exportar a trilha |
| **Terceiro** | Quem recebe o PDF depois | Conferir se é autêntico sem precisar de conta |

## Conceitos centrais

- **Organização** — o tenant. Nada de uma é visível a outra.
- **Documento (envelope)** — um PDF + signatários ordenados + ciclo de vida
  (`rascunho → em_andamento → concluido | recusado | expirado | cancelado`).
- **Nível de verificação** — `simples` (e-mail), `biometrico` (e-mail + rosto), `completo` (e-mail + rosto + voz + gestos).
- **Desafio** — o que o servidor sorteia para cada verificação; vale minutos.
- **Assinatura digital** — Ed25519 da plataforma sobre a carga canônica do signatário.
- **Selo** — Ed25519 sobre o hash do PDF final.
- **Trilha** — eventos append-only encadeados por hash.
- **Código de validação** — `LS-XXXX-XXXX`, impresso no PDF e no QR Code.

## Épicos do MVP (concluídos)

E0 Fundação · E1 Núcleo de segurança · E2 Autenticação · E3 Documentos · E4 Assinatura ·
E5 Auditoria e validação · E6 Gestão · E7 Qualidade · E8 Documentação — ver [`../status.md`](../status.md).

## Planos

| Plano | Envios/mês | Equipe |
|---|---|---|
| Básico (grátis) | 10 | até 3 |
| Profissional (R$ 89) | 100 | ilimitada |
| Empresarial (R$ 349) | ilimitados | ilimitada |

Limites aplicados **no servidor** (`apps/api/src/common/planos.ts`); o SPA só mostra, e um teste garante que
os dois dizem o mesmo. A troca de plano é simulada (sem cobrança).

## Evolução (pós-MVP)

| # | Item | Por quê |
|---|---|---|
| 1 | Provedor de *liveness* com atestação no servidor | Fecha o limite reconhecido no ADR 0004 |
| 2 | Ancoragem periódica do último hash da trilha (carimbo de tempo RFC 3161) | Impede reescrever a cadeia inteira (ADR 0003) |
| 3 | Row Level Security no Postgres | Segunda camada de isolamento (ADR 0006) |
| 4 | Posicionar a rubrica numa página/coordenada escolhida pelo remetente | Hoje ela vai no manifesto |
| 5 | Modelos de documento reutilizáveis | Envio recorrente com um clique |
| 6 | Lembretes automáticos antes do prazo | O job agendado já existe; falta a regra de janela |
| 7 | Webhooks e API pública com chave | Integração com ERPs e CRMs |
| 8 | Assinatura qualificada (certificado ICP-Brasil A1/A3) | Atos que a lei exige qualificada |
| 9 | Cobrança real dos planos | Hoje simulada |
| 10 | Worker de e-mail em processo separado e `@Cron` fora da API | Escalar a API horizontalmente sem jobs duplicados |
