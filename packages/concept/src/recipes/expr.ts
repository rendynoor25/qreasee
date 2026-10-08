/**
 * A tiny, safe arithmetic expression evaluator for recipe formulas. Deliberately
 * does NOT use `eval` or `new Function` (v4.2 K-00). Supports numbers, parameter
 * names, `+ - * / %`, parentheses, comparisons and ceil/floor/round/min/max/abs.
 */

export class ExprError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExprError";
  }
}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

const COMPARISONS = ["<=", ">=", "==", "!=", "<", ">"];
const SINGLE_OPS = ["(", ")", ",", "+", "-", "*", "/", "%", "<", ">"];

const FUNCS: Record<string, (args: number[]) => number> = {
  ceil: (a) => Math.ceil(a[0]),
  floor: (a) => Math.floor(a[0]),
  round: (a) => Math.round(a[0]),
  abs: (a) => Math.abs(a[0]),
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
};
const ARITY: Record<string, [number, number]> = {
  ceil: [1, 1],
  floor: [1, 1],
  round: [1, 1],
  abs: [1, 1],
  min: [1, Infinity],
  max: [1, Infinity],
};

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const num = Number(src.slice(i, j));
      if (!Number.isFinite(num)) throw new ExprError(`Bad number "${src.slice(i, j)}"`);
      toks.push({ t: "num", v: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "==" || two === "!=") {
      toks.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if (SINGLE_OPS.includes(c)) {
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new ExprError(`Unexpected character "${c}" in "${src}"`);
  }
  return toks;
}

class Parser {
  private pos = 0;
  constructor(
    private readonly toks: Tok[],
    private readonly vars: Record<string, number>,
    private readonly src: string,
  ) {}

  parse(): number {
    const v = this.comparison();
    if (this.pos < this.toks.length) throw new ExprError(`Unexpected token in "${this.src}"`);
    return v;
  }

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }

  private eat(v: string): boolean {
    const t = this.peek();
    if (t && t.t === "op" && t.v === v) {
      this.pos++;
      return true;
    }
    return false;
  }

  private comparison(): number {
    const l = this.additive();
    const t = this.peek();
    if (t && t.t === "op" && COMPARISONS.includes(t.v)) {
      this.pos++;
      const r = this.additive();
      switch (t.v) {
        case "<":
          return l < r ? 1 : 0;
        case "<=":
          return l <= r ? 1 : 0;
        case ">":
          return l > r ? 1 : 0;
        case ">=":
          return l >= r ? 1 : 0;
        case "==":
          return l === r ? 1 : 0;
        default:
          return l !== r ? 1 : 0;
      }
    }
    return l;
  }

  private additive(): number {
    let v = this.multiplicative();
    for (;;) {
      if (this.eat("+")) v += this.multiplicative();
      else if (this.eat("-")) v -= this.multiplicative();
      else break;
    }
    return v;
  }

  private multiplicative(): number {
    let v = this.unary();
    for (;;) {
      if (this.eat("*")) {
        v *= this.unary();
      } else if (this.eat("/")) {
        const d = this.unary();
        if (d === 0) throw new ExprError(`Division by zero in "${this.src}"`);
        v /= d;
      } else if (this.eat("%")) {
        const d = this.unary();
        if (d === 0) throw new ExprError(`Division by zero in "${this.src}"`);
        v %= d;
      } else break;
    }
    return v;
  }

  private unary(): number {
    if (this.eat("-")) return -this.unary();
    if (this.eat("+")) return this.unary();
    return this.primary();
  }

  private primary(): number {
    const t = this.peek();
    if (!t) throw new ExprError(`Unexpected end of expression "${this.src}"`);
    if (t.t === "num") {
      this.pos++;
      return t.v;
    }
    if (t.t === "id") {
      this.pos++;
      const name = t.v;
      if (this.eat("(")) {
        const args: number[] = [];
        if (!this.eat(")")) {
          do {
            args.push(this.comparison());
          } while (this.eat(","));
          if (!this.eat(")")) throw new ExprError(`Missing ")" in "${this.src}"`);
        }
        const fn = FUNCS[name];
        if (!fn) throw new ExprError(`Unknown function "${name}()"`);
        const [lo, hi] = ARITY[name];
        if (args.length < lo || args.length > hi) {
          throw new ExprError(`Wrong number of arguments for ${name}() in "${this.src}"`);
        }
        return fn(args);
      }
      if (!(name in this.vars)) throw new ExprError(`Unknown identifier "${name}" in "${this.src}"`);
      return this.vars[name];
    }
    if (t.t === "op" && t.v === "(") {
      this.pos++;
      const v = this.comparison();
      if (!this.eat(")")) throw new ExprError(`Missing ")" in "${this.src}"`);
      return v;
    }
    throw new ExprError(`Unexpected token "${t.v}" in "${this.src}"`);
  }
}

export function evalExpr(src: string, vars: Record<string, number> = {}): number {
  if (src.trim() === "") throw new ExprError("Empty expression");
  return new Parser(tokenize(src), vars, src).parse();
}

/** A missing or empty condition is treated as true. */
export function evalCondition(src: string | undefined, vars: Record<string, number> = {}): boolean {
  if (!src || src.trim() === "") return true;
  return evalExpr(src, vars) !== 0;
}
