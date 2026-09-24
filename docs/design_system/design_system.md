# Design System — LetsSign

> Os valores vivem em `apps/web/src/styles/tokens.css`. **Referencie, não redefina**: cor solta em
> hexadecimal num `.tsx` é o começo do fim de um design system.

## Princípios

1. **Confiança antes de tudo.** É um produto de assinatura: a interface precisa parecer tão sólida quanto a
   criptografia. Índigo profundo, superfícies calmas, tipografia firme.
2. **Status nunca só por cor.** Cor + ícone + rótulo, sempre.
3. **Semântica, não paleta, nos componentes.** Componente usa `bg-superficie`, nunca `bg-white` — é o que
   torna o tema escuro gratuito.
4. **Acessível por padrão.** Contraste AA calculado em teste; foco sempre visível; movimento reduzido respeitado.

## Duas camadas de token

**Paleta** (`@theme`) — valores brutos: `brand-50…950` (índigo), `violeta-*`, `ciano-*`, `noite-*` (superfícies
escuras da landing).

**Semântica** (`@theme inline` + variáveis em `:root` e `:root[data-tema='escuro']`):

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `fundo` | `#f6f7fb` | `#070a14` | fundo da página |
| `superficie` | `#ffffff` | `#0e1322` | cartão, modal, tabela |
| `superficie-2/3` | `#f3f4f9` / `#e9ebf3` | `#141a2e` / `#1c2340` | áreas secundárias, hover, esqueleto |
| `linha` / `linha-forte` | `#e4e7f0` / `#cdd2e1` | `#1f2742` / `#2c3659` | bordas e divisórias |
| `tinta` | `#0f1629` | `#eef1fb` | texto principal |
| `tinta-2` | `#4a5470` | `#aab3cf` | texto secundário |
| `tinta-3` | `#6b7390` | `#8891b0` | texto terciário, placeholder |
| `destaque` / `-suave` / `-tinta` | índigo | índigo claro | ação, seleção |
| `sucesso` · `alerta` · `perigo` · `neutro` | + `-suave` e `-tinta` | | status |

⚠️ **Texto de status usa sempre `*-tinta`**: as cores de status "puras" não passam 4,5:1 como texto sobre o
próprio fundo suave. O teste `src/test/contratos.test.ts` calcula todas as razões nos dois temas.

### Gradientes

```css
--gradiente-marca:       linear-gradient(135deg, #4f46e5, #7c3aed 52%, #06b6d4);  /* decoração */
--gradiente-marca-texto: linear-gradient(135deg, #4338ca, #6d28d9 55%, #0e7490);  /* sustenta texto branco */
```

O primeiro não sustenta texto branco na ponta ciano; botões e faixas com texto usam o `-texto` (teste
confere cada parada).

## Tipografia

| Token | Fonte | Uso |
|---|---|---|
| `font-display` | Plus Jakarta Sans | títulos, números de destaque |
| `font-sans` | Inter | corpo, formulários, tabelas |
| `font-mono` | JetBrains Mono | hashes, códigos (`LS-XXXX-XXXX`) |
| `font-assinatura` | Caveat | assinatura digitada |

Números em coluna usam `.numeros` (`tabular-nums`).

## Componentes (`src/components/ui/`)

| Componente | Variantes / notas |
|---|---|
| `Botao` / `estilosDeBotao()` | `primario · secundario · fantasma · perigo · claro · vidro`; `sm · md · lg`; `carregando` bloqueia o duplo envio; `type="button"` por padrão |
| `Cartao`, `CabecalhoDoCartao` | raio `--radius-cartao`, sombra `shadow-cartao` |
| `Campo` + `Entrada` · `AreaDeTexto` · `Seletor` | liga rótulo, dica e erro por `aria-*` |
| `Etiqueta`, `EtiquetaDoDocumento`, `EtiquetaDoSignatario` | tons `sucesso · alerta · perigo · info · neutro`, sempre com ícone |
| `Modal` | portal no `body`, foco preso, `Esc`, devolve o foco |
| `Esqueleto`, `Carregando`, `EstadoVazio`, `EstadoDeErro`, `Alerta` | os quatro estados de tela |
| `Abas`, `Paginacao`, `Avatar`, `BarraDeProgresso`, `Hash` | |
| `VisualizadorDePdf` | pdf.js, zoom, navegação por página |

Modal de confirmação global: `useConfirmacao()` — obrigatório em ação destrutiva.

## Ícones

`lucide-react` (SVG, `currentColor`, traço 2). O que não existe no lucide é desenhado no mesmo estilo em
`components/icones/` (ex.: `MaoEmV`). **Nunca emoji** na interface.

## Movimento

`motion` para entradas de seção e do hero; animações CSS (`surgir`, `flutuar`, `brilho`, `pulso-suave`) no
resto. Tudo desligado com `prefers-reduced-motion`.

## Tema escuro

`data-tema="escuro"` no `<html>`, aplicado por script inline **antes do primeiro paint** (a página não pisca).
Preferência salva em `localStorage` — é preferência de exibição, não dado sensível. Sem preferência salva,
segue o sistema operacional.
