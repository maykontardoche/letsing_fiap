# Arquitetura — Frontend (`apps/web`)

> **Leia antes de escrever código.** Convenções do SPA; os comandos estão no `.claude/stack-profile.md`.

## Stack

| Camada | Escolha |
|---|---|
| Framework | React 19 + TypeScript strict |
| Build | Vite 7 (proxy de `/api` em dev) |
| Estilo | Tailwind 4 (CSS-first, `@theme`) com tokens semânticos |
| Rotas | React Router 7, telas carregadas sob demanda (`lazy`) |
| Estado de servidor | TanStack Query |
| Formulários | React Hook Form + Zod |
| Gráficos | Chart.js + react-chartjs-2 |
| PDF | react-pdf (pdf.js) |
| Biometria | @vladmandic/face-api · Web Speech API · @mediapipe/tasks-vision — carregados só na etapa de verificação |
| Animação | motion |
| Testes | Vitest + Testing Library |

## Estrutura

```
src/
  app/
    providers/     Query → Sessão → Confirmação → Toaster (numa ordem só)
    router/        rotas, RotaProtegida, FronteiraDeErro
  components/
    ui/            Botao, Cartao, Campo/Entrada/Seletor, Modal, Etiqueta, Estados, Abas, Paginacao…
    layout/        AppShell, NavegacaoPublica, CabecalhoDaPagina
    pdf/           VisualizadorDePdf
    graficos/      GraficoMensal, GraficoDeRosca
    marca/, icones/
  constants/       mapas de fonte única: status, níveis, verificações, planos
  hooks/           useTema, useFiltrosNaUrl, useFocoPreso
  lib/             http (única porta de saída), erros, formatadores, navegacao, api/*
  pages/
    publico/       landing, validar
    auth/          entrar, cadastro, recuperação, MFA
    app/           painel, documentos (lista, novo, preparar, detalhe), equipe, auditoria, configurações
    assinar/       fluxo do signatário e as verificações
  styles/          tokens.css (paleta + semântica + temas), base.css
```

### Regras

- **Nenhum `fetch` fora de `lib/http.ts`.** Uma porta de saída, com `credentials: 'include'`.
- **Página busca e compõe; componente de `ui/` só renderiza** e nunca importa de `pages/`.
- **Mapas de fonte única** (`constants/`): rótulo, tom, ícone e ordem de status saem daí — nunca de um
  `switch` espalhado. A ordem é a do ciclo de vida, não a alfabética.
- **Estado derivado no render, não em efeito** (regra do React Compiler): ver `DocumentosPage`.

## Sessão

A sessão vive num cookie `httpOnly`; o SPA não guarda token nenhum. `SessaoProvider` só reflete
`GET /api/me` em quatro estados: **carregando, anônimo, precisa-mfa, autenticado**. Sair limpa todo o cache
do TanStack Query — dado de um usuário não reaparece para o próximo na mesma aba.

⚠️ `RotaProtegida` é **experiência**, não segurança: quem protege é a API.

## Estados obrigatórios por tela

Toda tela que busca dados trata os quatro: **carregando** (esqueleto com a forma do conteúdo), **erro**
(mensagem em pt-BR + "Tentar de novo"), **vazio** (diz o que fazer) e **conteúdo**. Erro de render cai
na `FronteiraDeErro`, nunca em tela branca.

## Regras de produto que a UI garante

- **Filtro, busca, ordenação e página na URL** (`useFiltrosNaUrl`); valor inválido cai no padrão; filtrar
  volta para a página 1.
- **Toda ação destrutiva passa por `useConfirmacao()`** (modal global) — cancelar, excluir, revogar, desativar.
- **Status nunca só por cor** — `EtiquetaDoDocumento` e `EtiquetaDoSignatario` sempre com ícone e rótulo.
- **`null` vira travessão**, nunca zero ("—" em vez de "0 h" quando não há tempo médio).
- **Toda tela injeta o próprio título** via `<CabecalhoDaPagina>` (também atualiza o `<title>`).
- **Biometria só no navegador** — as verificações enviam medições e resultado, nunca imagem ou áudio.

## Temas e design system

Tokens semânticos (`bg-fundo`, `text-tinta`, `border-linha`…) com tema **claro e escuro** trocados por
variável — nenhum componente sabe qual tema está ativo. Detalhes em
[`../design_system/design_system.md`](../design_system/design_system.md).

## Acessibilidade (WCAG 2.2 AA)

- Contraste ≥ 4,5:1 — **calculado a partir dos tokens** em `src/test/contratos.test.ts`, nos dois temas.
- Foco sempre visível; modal prende o foco, fecha no `Esc` e devolve o foco a quem abriu (`useFocoPreso`).
- `Campo` liga rótulo, dica e erro por `aria-describedby`; erro marca `aria-invalid`.
- Gráficos têm `aria-label` com os números; decoração é `aria-hidden`.
- `prefers-reduced-motion` desliga as animações.
- `jsx-a11y` no lint.

## Desempenho

- Rotas sob demanda: bundle inicial de ~188 KB gzip; face-api (1,3 MB) e MediaPipe só baixam na verificação.
- PDF renderizado no worker do pdf.js, fora da thread principal.
- Busca com espera (350 ms) — não dispara uma requisição por tecla.

## Checklist antes de submeter

- [ ] `npm run lint`, `npm run typecheck` e `npm run test` passam.
- [ ] Os quatro estados de UI tratados.
- [ ] Ação destrutiva pelo `useConfirmacao()`.
- [ ] Filtros na URL, com fallback para valor inválido.
- [ ] Foco visível; modal prende e devolve o foco.
- [ ] Funciona nos dois temas.
