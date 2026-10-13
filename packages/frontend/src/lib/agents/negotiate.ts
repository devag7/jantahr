/** Content negotiation for agents: does this Accept header ask for Markdown ahead of HTML? No imports: the middleware and the tests both load it. */

function quality(accept: string, type: string): number {
  let best = -1;
  for (const part of accept.split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';').map((s) => s.trim());
    if (name !== type) continue;
    const q = params.find((p) => p.startsWith('q='));
    const value = q ? Number(q.slice(2)) : 1;
    best = Math.max(best, Number.isFinite(value) ? value : 0);
  }
  return best;
}

/**
 * True when text/markdown is named with a quality above zero and at least as high as text/html. Browsers never name
 * text/markdown, and a bare wildcard does not count, so people keep getting HTML.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  const markdown = quality(accept, 'text/markdown');
  return markdown > 0 && markdown >= quality(accept, 'text/html');
}

/** Adds Accept to a Vary header value without repeating it. */
export function varyAccept(existing: string | null | undefined): string {
  const names = (existing ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return names.some((n) => n.toLowerCase() === 'accept' || n === '*') ? names.join(', ') : [...names, 'Accept'].join(', ');
}
