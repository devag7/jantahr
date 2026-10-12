import { withMinimumPool } from './prisma.service';

describe('withMinimumPool', () => {
  const base = 'postgresql://u:p%40ss@host:6543/postgres';
  it('raises a pool of one, keeping every other part of the URL', () => {
    expect(withMinimumPool(`${base}?pgbouncer=true&connection_limit=1`)).toBe(`${base}?pgbouncer=true&connection_limit=5`);
    expect(withMinimumPool(`${base}?connection_limit=2&pgbouncer=true`)).toBe(`${base}?connection_limit=5&pgbouncer=true`);
  });
  it('leaves a large enough pool, an unset limit and a missing URL alone', () => {
    expect(withMinimumPool(`${base}?connection_limit=5`)).toBeUndefined();
    expect(withMinimumPool(`${base}?connection_limit=20`)).toBeUndefined();
    expect(withMinimumPool(`${base}?schema=public`)).toBeUndefined();
    expect(withMinimumPool(undefined)).toBeUndefined();
  });
});
