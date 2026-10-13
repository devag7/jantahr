/**
 * Turns a rendered page into Markdown for agents that ask for text/markdown. It reads the HTML the site already
 * serves, so the Markdown can never drift from what people see. Only the <main> element is kept: navigation, footer,
 * scripts and decorative (aria-hidden) nodes are dropped. No imports: the route handler and the tests both load it.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', mdash: '—', ndash: '–', copy: '©' };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : null;
}

function absolute(href: string, base?: string): string {
  if (!base || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) return href;
  try { return new URL(href, base).toString(); } catch { return href; }
}

/** A link target Markdown can hold: no raw spaces or closing brackets. */
const target = (href: string, base?: string) => absolute(href, base).replace(/ /g, '%20').replace(/\)/g, '%29');

const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'wbr']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'ul', 'ol', 'dl', 'details', 'header', 'footer', 'aside', 'figure', 'blockquote', 'form', 'label', 'table']);

export function htmlToMarkdown(html: string, options: { baseUrl?: string } = {}): string {
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(html) ?? /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const source = (main ? main[1] : html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // an icon that carries a label is content ("Included"); any other inline SVG is decoration
    .replace(/<svg\b([^>]*)>[\s\S]*?<\/svg>/gi, (_, attrs: string) => (/aria-hidden\s*=\s*["']?true/i.test(attrs) ? '' : attr(attrs, 'aria-label') ?? ''));

  let out = '';
  let pre = false;
  let hidden: { tag: string; depth: number } | null = null;
  const links: { start: number; href: string }[] = [];
  const lists: { ordered: boolean; count: number }[] = [];
  let row: string[] | null = null;
  let cellStart = 0;
  let headerDone = false;
  let freshList = false;

  const text = (raw: string) => {
    if (hidden || !raw) return;
    if (pre) { out += decode(raw); return; }
    let collapsed = decode(raw).replace(/\s+/g, ' ');
    // a step that numbers itself inside an ordered list would read "1. 1. …"
    const marker = /(?:^|\n)\s*(\d+)\. $/.exec(out);
    if (marker && collapsed.startsWith(`${marker[1]}. `)) collapsed = collapsed.slice(marker[1].length + 2);
    if (collapsed === ' ' && /(?:^|\s)$/.test(out)) return;
    out += /\s$/.test(out) || out === '' ? collapsed.replace(/^ /, '') : collapsed;
  };
  // a paragraph inside a list item continues the item's line instead of leaving the marker on its own
  const block = () => { if (!row && !/(?:^|\n)\s*(?:- |\d+\. )$/.test(out)) out = out.replace(/[ \t]+$/, '') + '\n\n'; };
  // the first item of a list starts after a blank line, later items on the next line
  const item = () => { const gap = freshList && lists.length <= 1 ? '\n\n' : '\n'; freshList = false; out = out.replace(/\s+$/, '') + (out.trim() ? gap : ''); };

  const tags = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let last = 0;
  let spanClosedAt = -1;
  for (let m = tags.exec(source); m; m = tags.exec(source)) {
    text(source.slice(last, m.index));
    last = tags.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3];

    if (hidden) {
      if (tag === hidden.tag && !VOID.has(tag)) { hidden.depth += closing ? -1 : 1; if (hidden.depth === 0) hidden = null; }
      continue;
    }
    // decoration and controls (a billing-cycle toggle) are not content
    if (!closing && !VOID.has(tag) && (tag === 'button' || /aria-hidden\s*=\s*["']?true/i.test(attrs))) { hidden = { tag, depth: 1 }; continue; }

    if (/^h[1-6]$/.test(tag)) { block(); if (!closing) out += '#'.repeat(Number(tag[1])) + ' '; continue; }
    if (BLOCK.has(tag)) {
      block();
      if (tag === 'ul' || tag === 'ol') { if (closing) lists.pop(); else lists.push({ ordered: tag === 'ol', count: 0 }); }
      if (!closing && (tag === 'ul' || tag === 'ol' || tag === 'dl')) freshList = true;
      if (tag === 'table' && !closing) headerDone = false;
      continue;
    }
    switch (tag) {
      case 'br': out += pre ? '\n' : /\s$/.test(out) ? '' : ' '; break;
      case 'hr': block(); out += '---'; block(); break;
      case 'li': {
        if (closing) break;
        const list = lists[lists.length - 1];
        item();
        out += '  '.repeat(Math.max(0, lists.length - 1)) + (list?.ordered ? `${++list.count}. ` : '- ');
        break;
      }
      case 'dt': if (closing) out = out.replace(/\s+$/, '') + '**: '; else { item(); out += '- **'; } break;
      case 'summary': block(); if (closing) { out = out.replace(/\n+$/, '').replace(/\s+$/, '') + '**'; block(); } else out += '**'; break;
      // two spans side by side are set apart by CSS ("₹49" "per employee"): keep them apart in text too
      case 'span': if (closing) spanClosedAt = out.length; else if (spanClosedAt === out.length && out && !/\s$/.test(out)) out += ' '; break;
      case 'strong': case 'b': out += '**'; break;
      case 'em': case 'i': out += '*'; break;
      case 'code': if (!pre) out += '`'; break;
      case 'pre': block(); out += closing ? '```' : '```\n'; if (closing) { out = out.replace(/\n*```$/, '\n```'); block(); } pre = !closing; break;
      case 'img': { const alt = attr(attrs, 'alt'); const src = attr(attrs, 'src'); if (alt && src) out += `![${alt}](${target(src, options.baseUrl)})`; break; }
      case 'a': {
        if (!closing) { if (out.endsWith(')')) out += ' '; links.push({ start: out.length, href: attr(attrs, 'href') ?? '' }); break; }
        const link = links.pop();
        if (!link) break;
        const label = out.slice(link.start).trim();
        if (label && link.href) out = out.slice(0, link.start) + `[${label.replace(/\s*\n+\s*/g, ' ')}](${target(link.href, options.baseUrl)})`;
        break;
      }
      case 'tr': {
        if (!closing) { row = []; break; }
        if (!row) break;
        const cells = row; row = null;
        out = out.replace(/\s+$/, '') + `${headerDone || !out.trim() ? '\n' : '\n\n'}| ${cells.join(' | ')} |`;
        if (!headerDone) { out += `\n| ${cells.map(() => '---').join(' | ')} |`; headerDone = true; }
        break;
      }
      case 'th': case 'td': {
        if (!row) break;
        if (!closing) { cellStart = out.length; break; }
        row.push(out.slice(cellStart).trim().replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '\\|'));
        out = out.slice(0, cellStart);
        break;
      }
      default: break;
    }
  }
  text(source.slice(last));

  return out
    .split('\n').map((line) => line.replace(/[ \t]+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}
