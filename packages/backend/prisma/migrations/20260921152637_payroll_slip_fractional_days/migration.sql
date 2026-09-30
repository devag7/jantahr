/*
  Warnings:

  - You are about to alter the column `paymentDays` on the `SalarySlip` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to alter the column `absentDays` on the `SalarySlip` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to alter the column `leaveWithoutPay` on the `SalarySlip` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE "PayrollEntry" ADD COLUMN     "treatUnmarkedAsLop" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SalarySlip" ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "taxableEarnings" DECIMAL(15,2) NOT NULL DEFAULT 0,
ALTER COLUMN "paymentDays" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "absentDays" SET DEFAULT 0,
ALTER COLUMN "absentDays" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "leaveWithoutPay" SET DEFAULT 0,
ALTER COLUMN "leaveWithoutPay" SET DATA TYPE DECIMAL(5,2);
