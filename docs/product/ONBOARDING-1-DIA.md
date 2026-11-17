# Runbook — implantação do TutorPass em 1 dia

> A promessa é "implantação em 1 dia", não "implantação rápida". Este
> runbook é o que torna a promessa verdadeira no piloto: 53 minutos de
> trabalho da escola, o resto do dia é a saída rodando. O checklist
> (`OnboardingService`, `GET /api/onboarding/schools/:schoolId/checklist`)
> acompanha estes passos na mesma ordem e some quando zera.

## O dia 1, hora a hora

| Quando | Passo | Quem | Tempo | Feito quando |
|---|---|---|---|---|
| Manhã, ~9h | **1. Conta da escola** — cadastro (nome, CNPJ, contato); o tenant já nasce com papéis, ano letivo e trial de 30 dias | Diretoria/secretaria | ~3 min | Conta criada, primeiro ADMIN logado |
| Manhã, ~9h05 | **2. Alunos importados** — baixar o template CSV, preencher, importar com a prévia (dryRun) e corrigir os erros por linha antes de salvar | Secretaria | ~15 min | Roster com os alunos do dia, sem duplicata |
| Manhã, ~9h20 | **3. Equipe convidada** — portaria, salas e coordenação com credencial; o ADMIN já tem 2FA obrigatório | Secretaria | ~5 min | Staff logado no painel da portaria |
| Tarde, saída | **4. Primeira saída** — um tutor entra na fila, a portaria chama e libera; fila, telão e log funcionam de verdade | Portaria + 1 tutor | ~30 min | 1ª liberação registrada no PickupLog |

## O que pode dar errado (e o que fazer)

- **CSV com erro de formato** — a prévia (dryRun) lista o erro com o nº
  da linha e o resto do arquivo segue; corrigir só as linhas ruins e
  re-importar (a re-importação atualiza por matrícula, nunca apaga).
- **Aluno duplicado** — duplicata por nome + turma é pulada e relatada;
  re-importar com a matrícula atualiza, não duplica.
- **Staff sem 2FA** — o ADMIN é obrigado a configurar; quem é obrigado
  mas não cadastrou entra com a flag `twoFactorSetupRequired` e é levado
  à tela de Segurança.
- **Primeira saída sem tutor no app** — a portaria entra no modo MANUAL
  (`join` com `source: MANUAL`); o tutor por SMS/app entra no dia 2.

## A escola demo (antídoto da tela em branco)

A escola demo é o seed (`prisma/seed.ts`): 2 salas, 4 alunos, 6 usuários
nos 5 papéis, em TRIAL de 30 dias. Ela existe p/ a escola experimentar
sem medo de "estragar" o sistema — e **zera sozinha toda manhã** (job
diário 06:00 → `OnboardingService.resetDemo`, Step 2). Só a escola
marcada como demo pode ser zerada: o reset recusa qualquer outra escola,
p/ nunca apagar o progresso real de implantação de um cliente.

## O que NÃO está no dia 1 (não prometer)

- Integração com SIS (PowerSchool etc.) — o CSV é a integração da escola
  pequena; sync é fase 2.
- Cobrança/billing — o trial de 30 dias não pede cartão; o PRO só é
  cobrado quando o billing entrar.
- App mobile do tutor — o dia 1 roda no navegador (web mínimo); o app
  com QR dinâmico e geofence entra no Step 2.

## Fontes

- DismissPro (2026): 4 passos, demo que zera toda manhã.
- YESS (2026): "Abra sua escola em 24 horas", 5 passos testados.
- Attendzy (2026): checklist de 4 itens que some quando acaba.
- Foundation Roster (2026): "a pior parte do software novo são os
  primeiros 5 minutos" — ver `docs/product/IDEAS.md`, frente d, ciclo 25.
