# Módulo data-subject-requests

Ver `docs/01-arquitetura.md` para a responsabilidade deste módulo. Implementação entra no Step 2, sobre a fundação do Step 1.

## Exercício de direitos do titular (arts. 18/19 LGPD) — 17/11/2026

`DataSubjectRequestService` — o titular (ou o responsável legal do menor)
exerce os direitos do art. 18 pelo painel do admin: ACCESS (confirmação +
acesso), CORRECTION, ANONYMIZATION, BLOCKING, ERASURE, PORTABILITY,
SHARING_INFO (informação sobre compartilhamento) e CONSENT_REVOCATION.
O pedido é gratuito (art. 18, §5º); a escola (controladora) decide, o
TutorPass (operadora) executa e registra — nunca decide sozinho sobre dado
de aluno.

- **Dois prazos (art. 19)**: o acesso simplificado (confirmação da
  existência + acesso em formato simplificado) é IMEDIATO —
  `provideSimplifiedAccess` — e o ACCESS só é dado como atendido depois
  dele; a declaração completa tem até 15 dias corridos
  (`dueAt = receivedAt + 15 dias`). `listOverdue` é a fila do DPO toda
  manhã; `listSimplifiedAccessPending` é a fila do "imediato".
- **Identidade verificada antes de entregar dado**: OPEN →
  IDENTITY_VERIFIED → IN_PROGRESS. Pedido sem verificação não anda — um
  acesso atendido sem verificação vira vazamento com protocolo.
- **Eliminação nem sempre é possível (art. 16)**: ERASURE e
  ANONYMIZATION só aceitam PARTIAL e carregam
  `retainedByLegalObligation` — PickupLog, logs de auditoria, registro de
  consentimentos e incidentes nunca são apagados (apagar um evento quebra
  a cadeia de hash e apaga a prova da saída). A resposta diz O QUE foi
  apagado e O QUE foi mantido, com o fundamento.
- **Um pedido ativo por titular + tipo**; tipos diferentes correm em
  paralelo. Cada passo gera evento append-only com hash encadeado (mesmo
  padrão do PickupLog e do SecurityIncidentService). O pedido guarda só
  referências opacas (subjectId), nunca nome no log.

No Step 2, trocar o store in-memory por Prisma (`DataSubjectRequest` +
`DataSubjectRequestEvent`, já no schema); o atendimento de ERASURE executa
o expurgo de fato via RetentionService (o que for apagável) e registra o
que foi mantido; notificar o DPO em dual-path quando um pedido ficar a 2
dias do vencimento; o app do tutor abre o pedido direto (channel
SUBJECT_APP). O controller REST (`/api/data-subject-requests/schools/:schoolId/*`,
12 rotas, só ADMIN/COORDINATOR) expõe abrir, listar, filas do DPO,
verificar identidade, acesso simplificado, iniciar, atender, negar,
cancelar, anotar e ver o log.
