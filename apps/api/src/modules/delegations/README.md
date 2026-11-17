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

## Tag/cartão impresso p/ delegado sem smartphone (17/11/2026)

`PrintedTagService` — o responsável (ou a secretaria) emite a tag p/ o
delegado que não tem smartphone: código de 6 dígitos + QR com o mesmo
código (`TUTORPASS-TAG:<schoolId>:<código>`); a portaria digita ou escaneia,
com a mesma validação nos dois casos. Validade padrão 1 dia (máx. 30),
uso único por padrão (multiuso dentro da janela p/ a avó da semana toda);
código único entre as tags ativas da escola; sem sobreposição p/ mesmo
delegado + aluno; brute-force trava o código após 5 tentativas erradas em
15 min; recusa na portaria (documento não confere) invalida a tag de vez
(REFUSED) e devolve `notifyTutorId` p/ avisar o responsável (Step 2);
`refresh()`/`refreshAll()` marcam EXPIRED. No Step 2, trocar o store
in-memory por Prisma (`PrintedTag`, já no schema) e guardar só o hash do
código, como os recovery codes do 2FA.
