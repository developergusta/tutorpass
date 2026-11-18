---
name: anti-slop-ui
description: Caixa de ferramentas anti-genérica de UI/UX do TutorPass combinando Impeccable (typeset, shape, polish), Oil UI (subtração de excessos), Design Slop (auditoria de layout/acessibilidade) e No Slop UI (regras contra clichês de IA). Use em todos os ciclos de UI/UX e melhorias visuais do TutorPass.
---

# Anti-Slop UI/UX — Diretrizes Visuais TutorPass

Esta skill consolida as práticas de **Impeccable**, **Oil UI**, **Design Slop** e **No Slop UI** para garantir que nenhuma tela do TutorPass tenha aparência genérica de template gerado por IA.

## 1. No Slop UI — Proibições Estritas
- **Zero gradientes decorativos ou clichês de IA**: nunca usar gradientes roxo/azul/neon, blobs desfocados (`filter: blur(80px)`), glassmorphism gratuito ou sombras coloridas brilhantes. O único gradiente permitido no produto inteiro é a variação sutil de verde no painel "Pode retirar agora" do `/telao`.
- **Zero grades de cartões-clones com ícone em bolinha**: quando apresentar recursos, usar destaque assimétrico (pilares principais com espécime visual + lista editorial com divisores finos).
- **Zero emojis na interface operacional**: usar sempre ícones SVG monocromáticos (`stroke="currentColor"`, `strokeWidth="1.8"`) acompanhados de rótulo textual.
- **Zero números ou dados inventados nas telas operacionais**: estados vazios dizem a verdade em 1 linha com a próxima ação clara.

## 2. Impeccable — Typeset, Shape & Polish
- **Typeset (Tipografia e Ritmo)**:
  - Títulos (`h1`, `h2`) e marca em fonte de display (`Sora` / `Open Sans` no hero), peso máximo `600–700`, `letter-spacing: -0.02em`, sempre em **sentence case** (nunca frases inteiras em `UPPERCASE` com tracking largo; exceção única: selo de palavra única de ação como `AGORA` ou códigos/hashes monoespaciados).
  - Números operacionais, contadores, preços, relógios, códigos 2FA e ETAs **sempre** com `font-variant-numeric: tabular-nums`.
- **Shape (Composição e Hierarquia)**:
  - Ritmo vertical generoso entre seções da landing (`padding-top: var(--space-12)` a `var(--space-16)`).
  - Demonstrar o produto funcionando com artefatos reais (fila ao vivo, contador de QR de 30 s, rastro de hash encadeado `sha256`), nunca ilustrações genéricas.
- **Polish (Micro-interações e Superfícies)**:
  - Só aplicar `box-shadow` no `:hover` de elementos que possuam superfície real (`background: var(--card)`, `border` e `padding` completo). Nunca aplicar sombra de elevação em elementos com `background: transparent` ou `border-radius: 0`.

## 3. Oil UI — Checklist de Subtração
- Antes de encerrar qualquer mudança de UI, perguntar:
  1. Há algum contêiner dentro de contêiner que pode virar uma única superfície com divisor?
  2. Os preços, tempos e contagens estão escaneáveis em tabela/ledger em vez de escondidos em parágrafos longos?
  3. Sem o logotipo, a tela ainda é reconhecível como TutorPass pelo verde sólido `#07382a`/`#0b6e4f` e pela tipografia editorial?

## 4. Design Slop — Auditoria Obrigatória (Acessibilidade e Responsividade)
- **Alvos de toque**: todo botão, link de navegação, seletor ou ação de linha deve ter `min-height: 44px` (48px nas ações primárias).
- **Cor nunca sozinha (WCAG 1.4.1)**: avisos e status usam sempre ícone/forma + texto explícito, nunca apenas cor.
- **Movimento intencional (`prefers-reduced-motion`)**: animações marcam transições reais de estado (entrada na fila, chamada de aluno) ou interação direta do usuário, desligando-se quando `prefers-reduced-motion: reduce` estiver ativo.
