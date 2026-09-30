/**
 * One-time step when upgrading an existing installation to Supabase Auth: gives every JantaHR user without a
 * Supabase account one (random password, email confirmed) and links it. Users then choose their own password with
 * "Forgot password" on the sign-in page, or HR issues a temporary one with "Reset password".
 *   pnpm --filter jantahr-backend auth:link           (dry run: lists what would change)
 *   pnpm --filter jantahr-backend auth:link --apply
 */
import { NestFactory } from '@nestjs/core';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { IdentityService } from '../src/modules/identity/identity.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const identity = app.get(IdentityService);
  const users = await prisma.user.findMany({ where: { authId: null, email: { not: { endsWith: '@erased.invalid' } } }, orderBy: { createdAt: 'asc' } });
  console.log(`${users.length} user(s) without a Supabase account${apply ? '' : ' (dry run; add --apply)'}`);
  let linked = 0;
  for (const u of users) {
    if (!apply) { console.log(`  would link ${u.email}${u.isActive ? '' : ' (inactive: sign-in stays disabled)'}`); continue; }
    const authId = await identity.createUser(u.email, `${crypto.randomBytes(24).toString('base64url')}A1`);
    if (!u.isActive) await identity.setBanned(authId, true);
    await prisma.user.update({ where: { id: u.id }, data: { authId } });
    linked++;
    console.log(`  linked ${u.email}`);
  }
  if (apply) console.log(`${linked} linked. Ask users to set a password with "Forgot password".`);
  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
