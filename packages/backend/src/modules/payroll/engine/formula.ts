import { errorMessage } from '../../../common/utils/errors';
/**
 * Safe arithmetic evaluator for salary-structure formulas (no eval / Function).
 * Grammar:  cmp := add (('<'|'>'|'<='|'>='|'=='|'!=') add)?
 *           add := mul (('+'|'-') mul)*     mul := unary (('*'|'/'|'%') unary)*
 *           unary := ('-'|'+') unary | primary
 *           primary := NUMBER | IDENT | IDENT '(' args ')' | '(' cmp ')'
 * Functions: MIN, MAX, ROUND, FLOOR, CEIL, ABS, IF(cond, a, b)
 */
export class FormulaError extends Error {}

type Tok = { t: 'num' | 'id' | 'op' | 'lp' | 'rp' | 'comma' | 'end'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (!/^\d*\.?\d+$|^\d+\.$/.test(raw)) throw new FormulaError(`Invalid number "${raw}"`);
      out.push({ t: 'num', v: raw });
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j).toUpperCase() });
      i = j;
    } else if (c === '(') { out.push({ t: 'lp', v: c }); i++; }
    else if (c === ')') { out.push({ t: 'rp', v: c }); i++; }
    else if (c === ',') { out.push({ t: 'comma', v: c }); i++; }
    else if ('+-*/%'.includes(c)) { out.push({ t: 'op', v: c }); i++; }
    else if ('<>=!'.includes(c)) {
      const two = src.slice(i, i + 2);
      if (['<=', '>=', '==', '!='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; }
      else if (c === '<' || c === '>') { out.push({ t: 'op', v: c }); i++; }
      else throw new FormulaError(`Unexpected "${c}"`);
    } else throw new FormulaError(`Unexpected character "${c}"`);
  }
  out.push({ t: 'end', v: '' });
  return out;
}

const FUNCS: Record<string, (a: number[]) => number> = {
  MIN: (a) => Math.min(...a), MAX: (a) => Math.max(...a), ROUND: (a) => Math.round(a[0]),
  FLOOR: (a) => Math.floor(a[0]), CEIL: (a) => Math.ceil(a[0]), ABS: (a) => Math.abs(a[0]),
};

class Parser {
  private p = 0;
  constructor(private toks: Tok[], private vars: Record<string, number>, private used: Set<string>) {}

  private peek() { return this.toks[this.p]; }
  private next() { return this.toks[this.p++]; }
  private isOp(...ops: string[]) { const t = this.peek(); return t.t === 'op' && ops.includes(t.v); }

  parse(): number {
    const v = this.cmp();
    if (this.peek().t !== 'end') throw new FormulaError(`Unexpected "${this.peek().v}"`);
    return v;
  }

  private cmp(): number {
    const l = this.add();
    if (this.isOp('<', '>', '<=', '>=', '==', '!=')) {
      const op = this.next().v;
      const r = this.add();
      const res = op === '<' ? l < r : op === '>' ? l > r : op === '<=' ? l <= r : op === '>=' ? l >= r : op === '==' ? l === r : l !== r;
      return res ? 1 : 0;
    }
    return l;
  }

  private add(): number {
    let v = this.mul();
    while (this.isOp('+', '-')) v = this.next().v === '+' ? v + this.mul() : v - this.mul();
    return v;
  }

  private mul(): number {
    let v = this.unary();
    while (this.isOp('*', '/', '%')) {
      const op = this.next().v;
      const r = this.unary();
      if ((op === '/' || op === '%') && r === 0) throw new FormulaError('Division by zero');
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }

  private unary(): number {
    if (this.isOp('-')) { this.next(); return -this.unary(); }
    if (this.isOp('+')) { this.next(); return this.unary(); }
    return this.primary();
  }

  private primary(): number {
    const t = this.next();
    if (t.t === 'num') return parseFloat(t.v);
    if (t.t === 'lp') {
      const v = this.cmp();
      if (this.next().t !== 'rp') throw new FormulaError('Missing ")"');
      return v;
    }
    if (t.t === 'id') {
      if (this.peek().t === 'lp') {
        this.next();
        const args: number[] = [];
        if (this.peek().t !== 'rp') {
          args.push(this.cmp());
          while (this.peek().t === 'comma') { this.next(); args.push(this.cmp()); }
        }
        if (this.next().t !== 'rp') throw new FormulaError('Missing ")"');
        if (t.v === 'IF') {
          if (args.length !== 3) throw new FormulaError('IF needs 3 arguments');
          return args[0] ? args[1] : args[2];
        }
        const fn = FUNCS[t.v];
        if (!fn) throw new FormulaError(`Unknown function ${t.v}`);
        if (!args.length) throw new FormulaError(`${t.v} needs arguments`);
        return fn(args);
      }
      if (!(t.v in this.vars)) throw new FormulaError(`Unknown variable ${t.v}`);
      this.used.add(t.v);
      return this.vars[t.v];
    }
    throw new FormulaError(t.t === 'end' ? 'Unexpected end of formula' : `Unexpected "${t.v}"`);
  }
}

export function evaluateFormula(formula: string, vars: Record<string, number>): number {
  const upper: Record<string, number> = {};
  for (const [k, v] of Object.entries(vars)) upper[k.toUpperCase()] = v;
  const v = new Parser(tokenize(formula), upper, new Set()).parse();
  if (!Number.isFinite(v)) throw new FormulaError('Formula did not produce a finite number');
  return v;
}

/** Syntax + identifier check (dry run with all-ones for known variables). */
export function validateFormula(formula: string, knownVars: string[]): string | null {
  try {
    const vars: Record<string, number> = {};
    for (const k of knownVars) vars[k.toUpperCase()] = 1;
    evaluateFormula(formula, vars);
    return null;
  } catch (e) {
    return errorMessage(e);
  }
}
