-- CreateTable
CREATE TABLE "ComplianceFiling" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "reference" VARCHAR(120),
    "filedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filedById" TEXT NOT NULL,

    CONSTRAINT "ComplianceFiling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceFiling_companyId_key_key" ON "ComplianceFiling"("companyId", "key");
