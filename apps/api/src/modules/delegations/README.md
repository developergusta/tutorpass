# Módulo delegations

Ver `docs/01-arquitetura.md` para a responsabilidade deste módulo. Implementação entra no Step 2, sobre a fundação do Step 1.

## Autorização temporária com prazo (17/11/2026)

`TemporaryAuthorizationService` — o responsável autoriza um terceiro a retirar o(s)
aluno(s) por prazo determinado: **ONE_DAY** (1 dia, uso único — padrão PikMyKid),
**ONE_WEEK** (1 semana, multiuso) ou **ONE_MONTH** (1 mês, multiuso). Janela
`[startsAt, expiresAt)`; selfie do delegado é obrigatória (verificação visual na
portaria); sem sobreposição de janelas p/ mesmo delegado + aluno; revogação a
qualquer momento; `refresh()`/`refreshAll()` marcam EXPIRED (job diário, junto ao
expurgo LGPD e ao refresh de planos). No Step 2, trocar o store in-memory por
Prisma (`PickupAuthorization`, já no schema) e exigir, no controller,
`ConsentService.requireConsent(tutorId, 'DELEGATION_SELFIE')` antes de criar —
selfie é biométrico e exige consentimento explícito (LGPD art. 14).
