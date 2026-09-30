import * as fs from 'fs';
import { GENERATED_PATH, render } from '../../../scripts/plans-sync';

describe('pricing page data', () => {
  it('web app plan catalogue matches the API catalogue (run `pnpm plans:sync` if this fails)', () => {
    expect(fs.readFileSync(GENERATED_PATH, 'utf8')).toBe(render());
  });
});
