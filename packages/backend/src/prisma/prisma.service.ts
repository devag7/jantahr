import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Smallest usable pool. A scheduled job holds one connection for its advisory lock (runExclusive) while the job itself
 * queries on others, so a pool of one waits for a second connection until it times out and the job silently does nothing.
 */
const MIN_POOL = 5;
const LIMIT = /([?&]connection_limit=)(\d+)/;

/** DATABASE_URL with `connection_limit` raised to MIN_POOL when it is set lower; undefined when nothing needs changing. */
export function withMinimumPool(url: string | undefined): string | undefined {
  const found = url?.match(LIMIT);
  if (!url || !found || Number(found[2]) >= MIN_POOL) return undefined;
  return url.replace(LIMIT, `$1${MIN_POOL}`);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly poolRaised: boolean;

  constructor() {
    const url = withMinimumPool(process.env.DATABASE_URL);
    super(url ? { datasources: { db: { url } } } : {});
    this.poolRaised = !!url;
  }

  async onModuleInit() {
    if (this.poolRaised) this.logger.warn(`DATABASE_URL sets connection_limit below ${MIN_POOL}; using ${MIN_POOL} so scheduled jobs can hold their lock and still query.`);
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
