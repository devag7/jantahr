-- Supabase Auth becomes the only identity provider. Passwords, refresh/reset tokens, lockout counters and TOTP
-- secrets move out of JantaHR. Existing users are linked to Supabase accounts with `pnpm --filter jantahr-backend auth:link`
-- (they then set a password through "Forgot password"); two-factor must be enrolled again in Supabase.

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "failedLogins",
DROP COLUMN "lockedUntil",
DROP COLUMN "mfaSecret",
DROP COLUMN "passwordHash",
ADD COLUMN     "authId" VARCHAR(64),
ADD COLUMN     "sessionsRevokedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "PasswordResetToken";

-- DropTable
DROP TABLE "RefreshToken";

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");


-- old TOTP secrets are gone, so nobody may be required to present a factor they no longer have
UPDATE "User" SET "mfaEnabled" = false;
