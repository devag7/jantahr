import { runExclusive } from './cron-lock';

function fakePrisma(lockResults: boolean[]) {
  const queue = [...lockResults];
  const tx = { $queryRaw: jest.fn(async () => [{ locked: queue.shift() ?? false }]) };
  const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)), tx };
  return prisma as typeof prisma & Parameters<typeof runExclusive>[0];
}

describe('runExclusive', () => {
  it('runs the job when the advisory lock is acquired', async () => {
    const prisma = fakePrisma([true]);
    const job = jest.fn(async () => undefined);
    await expect(runExclusive(prisma, 'x', job)).resolves.toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
  });
  it('skips the job when another replica holds the lock', async () => {
    const prisma = fakePrisma([false]);
    const job = jest.fn(async () => undefined);
    await expect(runExclusive(prisma, 'x', job)).resolves.toBe(false);
    expect(job).not.toHaveBeenCalled();
  });
  it('uses a different lock key per job name', async () => {
    const prisma = fakePrisma([true, true]);
    await runExclusive(prisma, 'job-a', async () => undefined);
    await runExclusive(prisma, 'job-b', async () => undefined);
    const keys = prisma.tx.$queryRaw.mock.calls.map((c: unknown[]) => c[1]);
    expect(keys[0]).not.toEqual(keys[1]);
  });
});
