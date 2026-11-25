-- Fase 1 — Ficha do Pet (PetProfile 1:1 com Student + PetVaccination 1:N com Student).
-- 100% aditiva e opcional: escolas tradicionais não são afetadas.

CREATE TYPE "PetSize" AS ENUM ('PEQUENO', 'MEDIO', 'GRANDE');

CREATE TABLE "PetProfile" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "breed" TEXT,
    "size" "PetSize",
    "sex" TEXT,
    "weightKg" DOUBLE PRECISION,
    "isNeutered" BOOLEAN,
    "behaviorNotes" TEXT,
    "restrictions" TEXT,
    "feedingFood" TEXT,
    "feedingPortionGrams" INTEGER,
    "feedingTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vetName" TEXT,
    "vetClinic" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "dewormingUpToDate" BOOLEAN,
    "dewormingLastDate" DATE,
    "fleaControlUpToDate" BOOLEAN,
    "fleaControlLastDate" DATE,
    "allergies" TEXT,
    "medicationName" TEXT,
    "medicationDosage" TEXT,
    "medicationSchedule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PetVaccination" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "appliedAt" DATE,
    "expiresAt" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetVaccination_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PetProfile_studentId_key" ON "PetProfile"("studentId");
CREATE INDEX "PetProfile_schoolId_idx" ON "PetProfile"("schoolId");
CREATE INDEX "PetVaccination_schoolId_studentId_idx" ON "PetVaccination"("schoolId", "studentId");
CREATE INDEX "PetVaccination_studentId_expiresAt_idx" ON "PetVaccination"("studentId", "expiresAt");

ALTER TABLE "PetProfile" ADD CONSTRAINT "PetProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetProfile" ADD CONSTRAINT "PetProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PetVaccination" ADD CONSTRAINT "PetVaccination_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PetVaccination" ADD CONSTRAINT "PetVaccination_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
