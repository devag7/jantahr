-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "esiApplicable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pfApplicable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ptApplicable" BOOLEAN NOT NULL DEFAULT true;
