# 0004 — Biometria processada no navegador

**Estado:** aceita · 2026-09-24

## Contexto

O diferencial do LetsSign é comprovar a identidade de quem assina com rosto, voz e gestos. Mas biometria é
**dado pessoal sensível** (LGPD, art. 5º, II): coletar e guardar imagem de rosto ou gravação de voz traz
obrigações pesadas e um risco enorme em caso de vazamento.

## Decisão

- **Rosto com prova de vida:** `@vladmandic/face-api` (TinyFaceDetector + 68 marcos faciais). Piscada pelo
  *eye aspect ratio* (Soukupová & Čech, 2016); giro de cabeça pela posição do nariz entre as bordas do rosto.
- **Voz:** Web Speech API (`pt-BR`); a transcrição é conferida no servidor.
- **Gestos:** MediaPipe `GestureRecognizer`, exigindo o gesto mantido por 10 quadros.
- Tudo roda **no dispositivo**. Para o servidor vão só medições e resultado (ações cumpridas, quadros,
  confiança, transcrição curta). Nenhuma imagem, áudio ou vetor biométrico é transmitido ou gravado.
- **O servidor sorteia o desafio** (palavras, sequência de gestos, ações) com validade de minutos, limita
  tentativas e **avalia a resposta** com regras testadas.
- O **código por e-mail** é obrigatório em todos os níveis e vem primeiro.

## Limite reconhecido

Como a análise é local, um atacante técnico poderia forjar a *resposta* do navegador. As camadas acima
reduzem o risco (desafio aleatório e de curta duração, posse do e-mail, trilha com IP e horário, assinatura
digital amarrando tudo), mas não o eliminam. **Em produção**, o passo seguinte é um provedor de *liveness*
com atestação no servidor — mantendo a política de não reter biometria.

## Consequências

- ✅ Nenhuma biometria armazenada: um vazamento não expõe ninguém.
- ✅ Funciona sem serviço pago; modelos carregados sob demanda.
- ⚠️ Voz depende do navegador (Chrome/Edge); a tela avisa quando não há suporte.
- ⚠️ Os modelos vêm de CDN — a verificação precisa de internet.
