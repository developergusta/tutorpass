# Saída antecipada — EarlyDismissalService

O tutor pede a saída antecipada do aluno **pelo app** (dia, hora, motivo, quem busca);
a secretaria **aprova ou recusa**; o tutor vê a resposta no app; a portaria usa o
pedido aprovado na retirada. Sem bilhete de papel, sem ligação p/ a secretaria.

## Fluxo

```
REQUESTED → APPROVED → USED        (retirada feita)
REQUESTED → REJECTED               (secretaria recusa, com motivo p/ o tutor)
REQUESTED → CANCELLED              (só o tutor que pediu)
REQUESTED / APPROVED → EXPIRED     (horário passou — job diário via refresh())
```

## Regras

- **Motivo obrigatório** (≥ 3 caracteres) e **quem busca** informado — sem isso o
  pedido não é auditável e a secretaria não sabe quem esperar na portaria.
- **Cutoff de 30 min** (`EARLY_DISMISSAL_CUTOFF_MINUTES`): o pedido precisa chegar
  com pelo menos 30 min de antecedência. Pedido em cima da hora é recusado na
  origem, não na fila. (School Guardian usa janelas fixas 15h/16h/17h; nosso cutoff
  é mais flexível e a escola pode fixar janelas no Step 2.)
- **Um pedido ativo por aluno por dia** (REQUESTED ou APPROVED): sem duplicata.
- **Recusa exige motivo**: o tutor precisa saber por que não (ex.: prova marcada).
- **Cancelamento só pelo tutor que pediu e só enquanto REQUESTED**; pedido aprovado
  já comprometeu a sala — se mudar de ideia, fala com a secretaria.
- **Validade na retirada** (`isApprovedForPickup`): pedido APPROVED vale no dia
  pedido, a partir de 30 min antes do horário (tutor adiantado) até o fim do dia.

## Integração (Step 2)

- Persistir em `EarlyDismissalRequest` (já no `schema.prisma`) no lugar do store
  in-memory; expor REST `early-dismissal`: `POST /request`, `POST /:id/approve`,
  `POST /:id/reject`, `POST /:id/cancel` (tutor), `POST /:id/use` (portaria, via
  `validate-qr`).
- Cobrar a feature `EARLY_PICKUP` do plano: FREE não tem; TRIAL/PRO têm
  (ver `PlanService`).
- **Notificação dual-path** (ideia da frente f — ReadyBell): ao aprovar/recusar,
  notificar o tutor por push Expo **e** registrar a decisão em `AuditLog`/in-app,
  para push que falha não significar mensagem perdida. O serviço registra a decisão
  (`decidedBy`/`decidedAt`/`decisionNote`); o envio é do módulo de notificações.
- Pedido aprovado alimenta a fila realtime (`EventLogService`): o aluno aparece no
  painel da portaria/sala como "saída antecipada" no horário pedido.
- Rodar `refresh()` no job diário, junto ao expurgo LGPD, ao refresh de planos e ao
  refresh de autorizações temporárias.
