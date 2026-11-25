-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PET_ARRIVED';

-- CreateTable
CREATE TABLE "DayAttendance" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkInBy" UUID NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "pickupLogId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayAttendance_pickupLogId_key" ON "DayAttendance"("pickupLogId");

-- CreateIndex
CREATE UNIQUE INDEX "DayAttendance_studentId_date_key" ON "DayAttendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "DayAttendance_schoolId_date_idx" ON "DayAttendance"("schoolId", "date");

-- AddForeignKey
ALTER TABLE "DayAttendance" ADD CONSTRAINT "DayAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayAttendance" ADD CONSTRAINT "DayAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayAttendance" ADD CONSTRAINT "DayAttendance_pickupLogId_fkey" FOREIGN KEY ("pickupLogId") REFERENCES "PickupLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
