-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "labourCodeWages" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProfessionalTaxSlab" ADD COLUMN     "effectiveTo" TIMESTAMP(3);

-- Odisha repealed professional tax with effect from 1 April 2026 (Repeal Ordinance notified 21 April 2026).
UPDATE "ProfessionalTaxSlab" SET "effectiveTo" = DATE '2026-03-31' WHERE "state" = 'Odisha' AND "effectiveTo" IS NULL;

-- Madhya Pradesh: Rs.166 (Rs.174 in the last month) and Rs.208 (Rs.212) so the annual total is Rs.2,000 / Rs.2,500.
UPDATE "ProfessionalTaxSlab" SET "taxAmount" = 166, "februaryAmount" = 174 WHERE "state" = 'Madhya Pradesh' AND "taxAmount" = 167;
UPDATE "ProfessionalTaxSlab" SET "februaryAmount" = 212 WHERE "state" = 'Madhya Pradesh' AND "taxAmount" = 208 AND "februaryAmount" IS NULL;

-- Karnataka labour welfare fund: Rs.50 employee + Rs.100 employer, once a year (December).
UPDATE "LwfRate" SET "employeeAmount" = 50, "employerAmount" = 100 WHERE "state" = 'Karnataka' AND "employeeAmount" = 20;
