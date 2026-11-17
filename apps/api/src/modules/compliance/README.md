# Relatório de conformidade LGPD da escola (DPA-ready)

`ComplianceReportService` — gera o relatório que a diretoria mostra a pais
e à ANPD: o **Registro das Operações de Tratamento (RoPA, art. 37)** do
TutorPass, o resumo de consentimentos, retenção/expurgo, incidentes e um
**checklist de conformidade** com o que falta fazer.

## O que o relatório contém

- **RoPA** (`TREATMENT_ACTIVITIES`): 8 atividades fixas — cadastro, registro
  de retirada, QR dinâmico, geolocalização, selfie de delegação, foto do
  aluno, push e incidentes — cada uma com finalidade, categorias de dados,
  base legal, retenção, suboperadores e transferência internacional. A tabela
  é a fonte única de verdade: mudar o produto sem atualizar aqui deixa o
  relatório mentindo.
- **Consentimentos por finalidade**: ativos vs revogados, por finalidade,
  contados do estado real do `ConsentService` (o último evento decide).
- **Retenção e expurgo**: itens com retenção vencida aguardando expurgo
  (`RetentionService.dryRun`) e expurgos já registrados.
- **Incidentes**: total, abertos e com comunicação vencida (Res. CD/ANPD
  nº 15/2024 — 3 dias úteis).
- **Checklist**: DPO nomeado, aviso de privacidade com versão, expurgo em
  dia, incidentes sem vencimento, cadeias de auditoria íntegras,
  transferência internacional mapeada e RIPD. Cada item tem status
  (`OK` / `ATENCAO` / `PENDENTE`) e um detalhe acionável; `gaps` resume as
  pendências.

## O que o relatório NÃO contém

Dado pessoal. Só contagens, categorias e referências opacas (ids de
incidente) — nenhum nome de aluno/tutor, nenhum `subjectId`, nenhum
conteúdo. A única exceção é o contato do DPO, que é o dado de contato do
próprio relatório. O documento pode circular sem virar um segundo vazamento.

## Uso

```ts
const report = compliance.generate({
  schoolId: 'school-1',
  schoolName: 'Colégio Exemplo',
  dpoName: 'Maria Silva',
  dpoContact: 'dpo@colegioexemplo.com.br',
  noticeVersion: 'v3',
});
const markdown = compliance.toMarkdown(report); // documento p/ pais e ANPD
```

Sem dado, a seção diz "0" — nunca número inventado. O RIPD (art. 5º,
XVII) fica como pendência permanente do checklist: este relatório é o
inventário-base; a avaliação de risco é da escola e do DPO.
