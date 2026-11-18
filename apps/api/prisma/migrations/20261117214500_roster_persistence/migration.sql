-- Roster completo no Postgres (Step 2, 17/11/2026): turmas, alunos,
-- tutores e vínculos deixam de viver só em memória no RosterService.
-- - Classroom ganha isActive (a desativação de turma já existia no
--   cadastro em memória e não tinha coluna).
-- - Tutor ganha name/phone próprios (o cadastro tem nome/telefone de
--   responsáveis SEM conta) e o vínculo com o login (userId) vira
--   opcional, junto do qrSecret — a maioria dos responsáveis
--   cadastrados não tem login; o vínculo é feito depois, pela
--   secretaria. O índice único de userId permanece (Postgres aceita
--   vários NULLs num índice único).
ALTER TABLE "Classroom" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tutor" ADD COLUMN "name" TEXT;
ALTER TABLE "Tutor" ADD COLUMN "phone" TEXT;
ALTER TABLE "Tutor" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Tutor" ALTER COLUMN "qrSecret" DROP NOT NULL;
