-- AlterTable
ALTER TABLE "ProfessionalTaxSlab" ADD COLUMN     "deductionMonths" VARCHAR(20);

-- Half-yearly professional tax: Tamil Nadu (Chennai Corporation rates, deducted Sep & Mar) and Kerala (Aug & Feb).
INSERT INTO "ProfessionalTaxSlab" ("id","state","fromSalary","toSalary","taxAmount","frequency","deductionMonths","effectiveFrom","updatedAt")
SELECT gen_random_uuid(), v.state, v.f, v.t, v.a, 'HALF_YEARLY', v.m, DATE '2025-04-01', now()
FROM (VALUES
  ('Tamil Nadu', 0, 21000, 0, '9,3'), ('Tamil Nadu', 21000.01, 30000, 180, '9,3'), ('Tamil Nadu', 30000.01, 45000, 425, '9,3'),
  ('Tamil Nadu', 45000.01, 60000, 930, '9,3'), ('Tamil Nadu', 60000.01, 75000, 1025, '9,3'), ('Tamil Nadu', 75000.01, 1000000000000, 1250, '9,3'),
  ('Kerala', 0, 11999.99, 0, '8,2'), ('Kerala', 12000, 17999.99, 320, '8,2'), ('Kerala', 18000, 29999.99, 450, '8,2'), ('Kerala', 30000, 44999.99, 600, '8,2'),
  ('Kerala', 45000, 99999.99, 750, '8,2'), ('Kerala', 100000, 124999.99, 1000, '8,2'), ('Kerala', 125000, 1000000000000, 1250, '8,2')
) AS v(state, f, t, a, m)
WHERE EXISTS (SELECT 1 FROM "ProfessionalTaxSlab") AND NOT EXISTS (SELECT 1 FROM "ProfessionalTaxSlab" p WHERE p."state" = v.state);
