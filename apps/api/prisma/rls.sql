-- Defesa em profundidade: aplicar APÓS as migrations, como superuser/migration role.
-- A API define por transação: SET LOCAL app.current_school_id = '<uuid>';
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PickupQueueEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PickupLog" ENABLE ROW LEVEL SECURITY;
-- (repetir o padrão para todas as tabelas com schoolId)
CREATE POLICY tenant_isolation_student ON "Student"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);
CREATE POLICY tenant_isolation_queue ON "PickupQueueEntry"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);
CREATE POLICY tenant_isolation_pickup_log ON "PickupLog"
  USING ("schoolId" = current_setting('app.current_school_id', true)::uuid);
-- Imutabilidade: a role da aplicação não atualiza nem apaga log de retirada
-- REVOKE UPDATE, DELETE ON "PickupLog" FROM tutorpass_app;
-- REVOKE UPDATE, DELETE ON "AuditLog" FROM tutorpass_app;
