# PRD — LetsSign MVP

> Estado: **implementado** (ver [`../../docs/status.md`](../../docs/status.md)). Este PRD registra os
> requisitos do MVP no formato do harness; evoluções novas nascem em `tasks/prd-<slug>/` a partir do
> `/gera-prd`.

## Visão Geral

Assinar documentos à distância costuma cair em dois extremos: uma imagem de assinatura colada num PDF, que
não prova nada, ou um certificado digital ICP-Brasil, que a maioria das pessoas que assinam não tem.

O LetsSign entrega **assinatura eletrônica avançada** (Lei 14.063/2020): quem envia sobe o PDF e convida os
signatários; cada signatário comprova a identidade (código por e-mail, rosto com prova de vida, voz, gestos),
assina, e recebe um PDF final com manifesto, QR Code e prova criptográfica que qualquer pessoa confere.

## Objetivos

- Um documento vai do upload ao PDF selado **sem que o signatário crie conta**.
- **100% das assinaturas verificáveis** publicamente, recalculadas na hora (Ed25519 + SHA-256).
- **Adulteração detectável**: do PDF (hash) e da trilha de auditoria (cadeia de hash).
- **Nenhuma biometria armazenada** (LGPD, art. 5º, II).
- **Isolamento total** entre organizações, provado por teste.
- Métricas no painel: taxa de conclusão, tempo médio de conclusão, envios por mês, verificações por método.

## Histórias de Usuário

**Remetente (proprietário, administrador, membro)**

- HU-01 — Como remetente, quero enviar um PDF e convidar quem assina para não precisar imprimir nada.
- HU-02 — Como remetente, quero escolher o nível de verificação para exigir mais prova em contratos sensíveis.
- HU-03 — Como remetente, quero definir ordem de assinatura e prazo para respeitar o fluxo de aprovação.
- HU-04 — Como remetente, quero ver quem já assinou, quem abriu e quem falta, e reenviar o convite.
- HU-05 — Como remetente, quero cancelar um envio com motivo, invalidando os links.
- HU-06 — Como remetente, quero baixar o PDF final assinado e receber aviso quando concluir.

**Signatário (sem conta)**

- HU-07 — Como signatário, quero ler o documento inteiro antes de decidir.
- HU-08 — Como signatário, quero comprovar minha identidade pelo celular ou computador, com instruções claras.
- HU-09 — Como signatário, quero desenhar ou digitar minha rubrica e concordar explicitamente com o conteúdo.
- HU-10 — Como signatário, quero poder recusar com um motivo.
- HU-11 — Como signatário, quero receber o PDF final por e-mail.

**Gestão**

- HU-12 — Como proprietário, quero convidar pessoas e definir papéis.
- HU-13 — Como auditor, quero ver a trilha completa, examinar a integridade e exportar.
- HU-14 — Como usuário, quero ativar a verificação em duas etapas e encerrar sessões que não reconheço.

**Terceiro**

- HU-15 — Como quem recebeu o PDF, quero conferir se ele é autêntico sem precisar de conta.

## Funcionalidades Principais

### F1 — Conta e organização
- RF-01 Cadastro cria a organização e o proprietário.
- RF-02 Login com e-mail e senha; mensagem ambígua; bloqueio após 5 erros por e-mail+IP.
- RF-03 MFA TOTP opcional, por sessão, com 8 códigos de recuperação de uso único.
- RF-04 Recuperação de senha por link de uso único (1 h); convite de equipe pelo mesmo mecanismo (72 h).
- RF-05 Papéis: proprietário, administrador, membro, auditor; autorização por permissão, no servidor.

### F2 — Documentos
- RF-06 Upload de PDF (≤ 20 MB, ≤ 300 páginas), validado pelo conteúdo; SHA-256 registrado.
- RF-07 Rascunho editável: título, mensagem, signatários (1–20, CPF opcional e cifrado), nível, ordem, prazo.
- RF-08 Envio respeita a cota do plano; emite link único por signatário.
- RF-09 Listagem com busca, filtro por status, ordenação e paginação, com estado na URL.
- RF-10 Cancelamento com motivo; reenvio de convite rotacionando o link; "assinar agora" para quem é signatário.

### F3 — Assinatura
- RF-11 Verificações por nível, em ordem fixa: código por e-mail → rosto com prova de vida → voz → gestos.
- RF-12 Desafios sorteados no servidor, com validade e limite de tentativas.
- RF-13 Assinatura exige todas as verificações aprovadas (30 min), rubrica e concordância explícita.
- RF-14 Assinatura digital Ed25519 sobre carga canônica com hash do original, identidade e verificações.
- RF-15 Ordem sequencial convida o próximo automaticamente; recusa encerra o documento.
- RF-16 Conclusão gera o PDF final (rodapé, manifesto, QR, evidências embutidas), sela e envia por e-mail.

### F4 — Confiança
- RF-17 Trilha append-only encadeada por hash, escrita na mesma transação da mudança de estado.
- RF-18 Validação pública por código ou arrastando o PDF (hash no navegador), com veredito recalculado.
- RF-19 Exame de integridade de todas as cadeias e exportação CSV.

### F5 — Painel
- RF-20 Indicadores, série de 12 meses, distribuição por status, pendências da pessoa, atividade recente.
- RF-21 Notificações in-app.

## Experiência do Usuário

- Landing pública com proposta de valor, como funciona, biometria, segurança, planos e FAQ.
- Área logada com menu por permissão, busca global, tema claro/escuro e notificações.
- Fluxo do signatário em 3 etapas visíveis (revisar · confirmar identidade · assinar), com orientação ao vivo
  (oval de enquadramento, palavras marcando conforme ditas, barra de gesto mantido).
- **Acessibilidade WCAG 2.2 AA**: contraste ≥ 4,5:1 nos dois temas, foco visível, modais com foco preso,
  status com ícone e rótulo, textos e mensagens de erro em pt-BR, `prefers-reduced-motion`.
- Estados de carregamento, erro, vazio e conteúdo em toda tela.

## Restrições Técnicas de Alto Nível

- Lei 14.063/2020 e MP 2.200-2/2001 (assinatura eletrônica avançada); LGPD (biometria como dado sensível).
- Biometria processada no dispositivo; nenhum dado biométrico transmitido ou retido.
- Dado pessoal cifrado em repouso; nada sensível em log.
- Multiempresa com isolamento total.
- Roda localmente com Node 22 e Docker.

## Fora de Escopo

- Assinatura qualificada com certificado ICP-Brasil.
- Posicionamento da rubrica em coordenadas do PDF original (vai no manifesto).
- Cobrança real dos planos (troca simulada).
- Provedor externo de *liveness* com atestação no servidor.
- API pública, webhooks e modelos de documento.
