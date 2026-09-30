-- CreateEnum
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE', 'NOMINATION');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BreachSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BreachStatus" AS ENUM ('INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'CLOSED');

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" VARCHAR(60) NOT NULL,
    "noticeVersion" INTEGER NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "PrivacyRequestType" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBreach" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "BreachSeverity" NOT NULL,
    "status" "BreachStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "occurredAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "affectedCount" INTEGER,
    "dataCategories" VARCHAR(500),
    "containmentActions" TEXT,
    "boardNotifiedAt" TIMESTAMP(3),
    "principalsNotifiedAt" TIMESTAMP(3),
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataBreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_purpose_createdAt_idx" ON "ConsentRecord"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_companyId_idx" ON "ConsentRecord"("companyId");

-- CreateIndex
CREATE INDEX "PrivacyRequest_companyId_status_idx" ON "PrivacyRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "PrivacyRequest_employeeId_idx" ON "PrivacyRequest"("employeeId");

-- CreateIndex
CREATE INDEX "DataBreach_companyId_status_idx" ON "DataBreach"("companyId", "status");
