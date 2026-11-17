-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COORDINATOR', 'GATE_AGENT', 'TEACHER', 'TUTOR');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('FATHER', 'MOTHER', 'GRANDPARENT', 'SIBLING', 'GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('QUEUED', 'CALLED', 'AT_GATE', 'VALIDATED', 'RELEASED', 'BLOCKED', 'CANCELLED', 'EXPIRED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PickupEventType" AS ENUM ('QUEUE_JOINED', 'QUEUE_CALLED', 'QR_SCANNED', 'QR_REJECTED', 'STUDENT_LEFT_CLASSROOM', 'RELEASED', 'BLOCKED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'USED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EarlyDismissalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GeoZone" AS ENUM ('OUTSIDE', 'APPROACH', 'ARRIVAL');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'TRIAL', 'PRO');

-- CreateEnum
CREATE TYPE "DismissalMode" AS ENUM ('CAR', 'WALK', 'BUS', 'AFTER_SCHOOL');

-- CreateEnum
CREATE TYPE "DismissalExceptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('EARLY_DISMISSAL_DECISION', 'STUDENT_CALLED', 'PLAN_CHANGED', 'AUTHORIZATION_CREATED', 'PICKUP_COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationPushStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED_NO_CONSENT', 'SKIPPED_NO_TOKEN', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "SecurityIncidentCategory" AS ENUM ('WRONG_RECIPIENT', 'OPEN_SPREADSHEET', 'LOST_DEVICE', 'UNAUTHORIZED_ACCESS', 'RANSOMWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityIncidentStatus" AS ENUM ('OPEN', 'CONTAINED', 'COMMUNICATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VanDirection" AS ENUM ('TO_SCHOOL', 'TO_HOME');

-- CreateEnum
CREATE TYPE "VanRouteStatus" AS ENUM ('PLANNED', 'RUNNING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VanStopStatus" AS ENUM ('WAITING', 'BOARDED', 'DELIVERED', 'ABSENT', 'NOT_RIDING');

-- CreateTable
CREATE TABLE "School" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "document" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "refId" TEXT,
    "pushStatus" "NotificationPushStatus" NOT NULL DEFAULT 'QUEUED',
    "pushAttempts" INTEGER NOT NULL DEFAULT 0,
    "pushLastError" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "familyExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByJti" UUID,
    "replacedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorEnrollment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "recoveryCodeHashes" TEXT[],
    "lastUsedStep" BIGINT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwoFactorEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMember" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "classroomId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "academicYear" INTEGER NOT NULL,
    "roomLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "birthDate" DATE,
    "enrollmentCode" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "pickupBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tutor" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "document" TEXT,
    "photoUrl" TEXT,
    "qrSecret" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorStudent" (
    "tutorId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "relationship" "Relationship" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canPickup" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorStudent_pkey" PRIMARY KEY ("tutorId","studentId")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "tutorId" UUID NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPoint" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "approachRadiusM" INTEGER NOT NULL DEFAULT 800,
    "arrivalRadiusM" INTEGER NOT NULL DEFAULT 250,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupAuthorization" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "tutorId" UUID NOT NULL,
    "delegateName" TEXT NOT NULL,
    "delegateDocument" TEXT NOT NULL,
    "delegateSelfieUrl" TEXT NOT NULL,
    "delegatePhotoUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupAuthorizationStudent" (
    "authorizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,

    CONSTRAINT "PickupAuthorizationStudent_pkey" PRIMARY KEY ("authorizationId","studentId")
);

-- CreateTable
CREATE TABLE "EarlyDismissalRequest" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "tutorId" UUID NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "pickupBy" TEXT NOT NULL,
    "status" "EarlyDismissalStatus" NOT NULL DEFAULT 'REQUESTED',
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "usedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarlyDismissalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarlyDismissalStudent" (
    "requestId" UUID NOT NULL,
    "studentId" UUID NOT NULL,

    CONSTRAINT "EarlyDismissalStudent_pkey" PRIMARY KEY ("requestId","studentId")
);

-- CreateTable
CREATE TABLE "PickupQueueEntry" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "tutorId" UUID NOT NULL,
    "authorizationId" UUID,
    "pickupPointId" UUID,
    "vehicleId" UUID,
    "status" "QueueStatus" NOT NULL DEFAULT 'QUEUED',
    "source" TEXT NOT NULL DEFAULT 'GEOFENCE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "waitSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupLog" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "queueEntryId" UUID,
    "eventType" "PickupEventType" NOT NULL,
    "actorUserId" UUID,
    "tutorId" UUID,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "subjectUnder12" BOOLEAN NOT NULL,
    "purpose" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "grantedByUserId" UUID NOT NULL,
    "grantedByRole" TEXT NOT NULL,
    "explicit" BOOLEAN NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DismissalDefaultPlan" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "mode" "DismissalMode" NOT NULL,
    "busLine" TEXT,
    "pickupBy" TEXT,
    "note" TEXT,
    "setBy" UUID NOT NULL,
    "setByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DismissalDefaultPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DismissalException" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "mode" "DismissalMode" NOT NULL,
    "busLine" TEXT,
    "pickupBy" TEXT,
    "note" TEXT,
    "status" "DismissalExceptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" UUID NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DismissalException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPlan" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "tier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "trialEndsAt" TIMESTAMP(3),
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SecurityIncidentCategory" NOT NULL,
    "dataCategories" TEXT[],
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "relevantRisk" BOOLEAN NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "dpoContact" TEXT,
    "status" "SecurityIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "communicationDueAt" TIMESTAMP(3) NOT NULL,
    "supplementDueAt" TIMESTAMP(3) NOT NULL,
    "anpdNotifiedAt" TIMESTAMP(3),
    "subjectsNotifiedAt" TIMESTAMP(3),
    "supplementSentAt" TIMESTAMP(3),
    "containedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanRoute" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "driverId" TEXT NOT NULL,
    "direction" "VanDirection" NOT NULL,
    "date" TEXT NOT NULL,
    "expectedDurationMin" INTEGER NOT NULL DEFAULT 90,
    "status" "VanRouteStatus" NOT NULL DEFAULT 'PLANNED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VanRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanRouteStop" (
    "id" UUID NOT NULL,
    "vanRouteId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "VanStopStatus" NOT NULL DEFAULT 'WAITING',
    "boardedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "absentAt" TIMESTAMP(3),
    "notRidingAt" TIMESTAMP(3),
    "notRidingBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VanRouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_schoolId_createdAt_idx" ON "Notification"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_familyId_idx" ON "RefreshToken"("userId", "familyId");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorEnrollment_userId_key" ON "TwoFactorEnrollment"("userId");

-- CreateIndex
CREATE INDEX "SchoolMember_schoolId_role_idx" ON "SchoolMember"("schoolId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMember_schoolId_userId_role_key" ON "SchoolMember"("schoolId", "userId", "role");

-- CreateIndex
CREATE INDEX "Classroom_schoolId_idx" ON "Classroom"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_schoolId_name_academicYear_key" ON "Classroom"("schoolId", "name", "academicYear");

-- CreateIndex
CREATE INDEX "Student_schoolId_classroomId_status_idx" ON "Student"("schoolId", "classroomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_enrollmentCode_key" ON "Student"("schoolId", "enrollmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Tutor_userId_key" ON "Tutor"("userId");

-- CreateIndex
CREATE INDEX "Tutor_schoolId_idx" ON "Tutor"("schoolId");

-- CreateIndex
CREATE INDEX "Vehicle_tutorId_idx" ON "Vehicle"("tutorId");

-- CreateIndex
CREATE INDEX "PickupPoint_schoolId_idx" ON "PickupPoint"("schoolId");

-- CreateIndex
CREATE INDEX "PickupAuthorization_schoolId_status_expiresAt_idx" ON "PickupAuthorization"("schoolId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "EarlyDismissalRequest_schoolId_status_requestedAt_idx" ON "EarlyDismissalRequest"("schoolId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "EarlyDismissalRequest_tutorId_idx" ON "EarlyDismissalRequest"("tutorId");

-- CreateIndex
CREATE INDEX "PickupQueueEntry_schoolId_status_createdAt_idx" ON "PickupQueueEntry"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PickupQueueEntry_studentId_idx" ON "PickupQueueEntry"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupLog_queueEntryId_key" ON "PickupLog"("queueEntryId");

-- CreateIndex
CREATE INDEX "PickupLog_schoolId_studentId_createdAt_idx" ON "PickupLog"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "PickupLog_schoolId_createdAt_idx" ON "PickupLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_schoolId_subjectId_purpose_createdAt_idx" ON "ConsentRecord"("schoolId", "subjectId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "DismissalDefaultPlan_schoolId_idx" ON "DismissalDefaultPlan"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "DismissalDefaultPlan_studentId_weekday_key" ON "DismissalDefaultPlan"("studentId", "weekday");

-- CreateIndex
CREATE INDEX "DismissalException_schoolId_date_status_idx" ON "DismissalException"("schoolId", "date", "status");

-- CreateIndex
CREATE INDEX "DismissalException_studentId_date_idx" ON "DismissalException"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPlan_schoolId_key" ON "SchoolPlan"("schoolId");

-- CreateIndex
CREATE INDEX "SecurityIncident_schoolId_status_idx" ON "SecurityIncident"("schoolId", "status");

-- CreateIndex
CREATE INDEX "SecurityIncident_schoolId_communicationDueAt_idx" ON "SecurityIncident"("schoolId", "communicationDueAt");

-- CreateIndex
CREATE INDEX "VanRoute_schoolId_driverId_status_idx" ON "VanRoute"("schoolId", "driverId", "status");

-- CreateIndex
CREATE INDEX "VanRoute_schoolId_date_idx" ON "VanRoute"("schoolId", "date");

-- CreateIndex
CREATE INDEX "VanRouteStop_vanRouteId_order_idx" ON "VanRouteStop"("vanRouteId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "VanRouteStop_vanRouteId_studentId_key" ON "VanRouteStop"("vanRouteId", "studentId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorEnrollment" ADD CONSTRAINT "TwoFactorEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tutor" ADD CONSTRAINT "Tutor_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tutor" ADD CONSTRAINT "Tutor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorStudent" ADD CONSTRAINT "TutorStudent_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorStudent" ADD CONSTRAINT "TutorStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPoint" ADD CONSTRAINT "PickupPoint_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupAuthorization" ADD CONSTRAINT "PickupAuthorization_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupAuthorization" ADD CONSTRAINT "PickupAuthorization_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupAuthorizationStudent" ADD CONSTRAINT "PickupAuthorizationStudent_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "PickupAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupAuthorizationStudent" ADD CONSTRAINT "PickupAuthorizationStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarlyDismissalRequest" ADD CONSTRAINT "EarlyDismissalRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarlyDismissalRequest" ADD CONSTRAINT "EarlyDismissalRequest_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarlyDismissalStudent" ADD CONSTRAINT "EarlyDismissalStudent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EarlyDismissalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarlyDismissalStudent" ADD CONSTRAINT "EarlyDismissalStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupQueueEntry" ADD CONSTRAINT "PickupQueueEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupQueueEntry" ADD CONSTRAINT "PickupQueueEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupQueueEntry" ADD CONSTRAINT "PickupQueueEntry_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupLog" ADD CONSTRAINT "PickupLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupLog" ADD CONSTRAINT "PickupLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupLog" ADD CONSTRAINT "PickupLog_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "PickupQueueEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DismissalDefaultPlan" ADD CONSTRAINT "DismissalDefaultPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DismissalDefaultPlan" ADD CONSTRAINT "DismissalDefaultPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DismissalException" ADD CONSTRAINT "DismissalException_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DismissalException" ADD CONSTRAINT "DismissalException_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPlan" ADD CONSTRAINT "SchoolPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanRoute" ADD CONSTRAINT "VanRoute_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanRouteStop" ADD CONSTRAINT "VanRouteStop_vanRouteId_fkey" FOREIGN KEY ("vanRouteId") REFERENCES "VanRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanRouteStop" ADD CONSTRAINT "VanRouteStop_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

