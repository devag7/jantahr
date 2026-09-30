-- AlterTable
ALTER TABLE "EmployeeTaxDeclaration" ADD COLUMN     "childrenCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SalaryComponent" ADD COLUMN     "exemptionCode" VARCHAR(30);
