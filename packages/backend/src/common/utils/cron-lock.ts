import { PrismaService } from '../../prisma/prisma.service';

/** Stable 31-bit key from a job name (advisory locks take integers). */
function keyOf(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Runs `fn` on exactly one API replica: whichever instance takes the transaction-scoped advisory lock first.
 * Other replicas skip that tick. The lock is released when the (otherwise idle) transaction ends.
 */
export async function runExclusive(prisma: PrismaService, jobName: string, fn: () => Promise<unknown>): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${keyOf(jobName)}) AS locked`;
      if (!rows[0]?.locked) return false;
      await fn();
      return true;
    },
    { timeout: 30 * 60 * 1000, maxWait: 10_000 },
  );
}
