/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Calculator expression engine

   A hand-written recursive-descent parser (shunting-free, no `eval`, no
   `new Function`) so an expression typed into the calculator can never execute
   arbitrary code. Grammar:

     expr    := term (('+' | '-') term)*
     term    := unary (('×' | '÷' | '*' | '/') unary | implicit-mul unary)*
     unary   := ('-' | '+') unary | power
     power   := postfix ('^' unary)?
     postfix := primary (('!' | '%') )*
     primary := number | 'π' | 'e' | func '(' args ')' | '(' expr ')'

   Angles are interpreted in degrees or radians according to the caller.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AngleMode = "deg" | "rad";

export interface EngineState {
  mode: AngleMode;
  /** Second-function toggle — swaps sin↔asin, log↔10^x, etc. */
  second: boolean;
}

const FACTORIAL_LIMIT = 170;

function factorial(n: number): number {
  if (n < 0 || n % 1 !== 0 || n > FACTORIAL_LIMIT) return NaN;
  let out = 1;
  for (let k = 2; k <= n; k++) out *= k;
  return out;
}

/** Tokenizer: numbers, π, e, function names, operators and grouping. */
function tokenize(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === ".") {
        j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      out.push(src.slice(i, j));
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      out.push(src.slice(i, j).toLowerCase());
      i = j;
      continue;
    }
    if ("+-×÷√*/^!%()π".includes(ch)) {
      out.push(ch);
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return out;
}

type Fn = (x: number) => number;

function buildFunctions(state: EngineState): Record<string, Fn> {
  const toRad = (x: number) => (state.mode === "deg" ? (x * Math.PI) / 180 : x);
  const toDeg = (x: number) => (state.mode === "deg" ? (x * 180) / Math.PI : x);
  return {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => toDeg(Math.asin(x)),
    acos: (x) => toDeg(Math.acos(x)),
    atan: (x) => toDeg(Math.atan(x)),
    ln: (x) => Math.log(x),
    log: (x) => Math.log10(x),
    "√": (x) => Math.sqrt(x),
    cbrt: (x) => Math.cbrt(x),
    abs: (x) => Math.abs(x),
    exp: (x) => Math.exp(x),
  };
}

/**
 * Evaluate an expression string.
 * Throws on malformed input — callers surface "Error" in the display.
 */
export function evaluate(expression: string, state: EngineState): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 0;
  const F = buildFunctions(state);
  let pos = 0;

  const peek = (): string | undefined => tokens[pos];
  const next = (): string | undefined => tokens[pos++];

  const parseExpr = (): number => {
    let value = parseTerm();
    for (;;) {
      const t = peek();
      if (t === "+" || t === "-") {
        next();
        const rhs = parseTerm();
        value = t === "+" ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    for (;;) {
      const t = peek();
      if (t === "×" || t === "*" || t === "÷" || t === "/") {
        next();
        const rhs = parseUnary();
        value = t === "×" || t === "*" ? value * rhs : value / rhs;
        continue;
      }
      // Implicit multiplication — "2π", "3(4+5)", "2sin(...)".
      if (t !== undefined && (/^[\d.a-zπ√]/i.test(t) || t === "(")) {
        value *= parseUnary();
        continue;
      }
      return value;
    }
  };

  const parseUnary = (): number => {
    const t = peek();
    if (t === "-") {
      next();
      return -parseUnary();
    }
    if (t === "+") {
      next();
      return parseUnary();
    }
    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePostfix();
    if (peek() === "^") {
      next();
      return Math.pow(base, parseUnary());
    }
    return base;
  };

  const parsePostfix = (): number => {
    let value = parsePrimary();
    for (;;) {
      const t = peek();
      if (t === "!" || t === "%") {
        next();
        value = t === "!" ? factorial(value) : value / 100;
        continue;
      }
      return value;
    }
  };

  const parsePrimary = (): number => {
    const t = next();
    if (t === undefined) throw new Error("Unexpected end of expression");
    if (t === "(") {
      const value = parseExpr();
      if (next() !== ")") throw new Error("Missing closing parenthesis");
      return value;
    }
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (t === "π") return Math.PI;
    if (t === "e") return Math.E;
    if (F[t]) {
      if (peek() === "(") {
        next();
        const arg = parseExpr();
        if (next() !== ")") throw new Error("Missing closing parenthesis");
        return F[t](arg);
      }
      return F[t](parsePower());
    }
    throw new Error(`Unknown function "${t}"`);
  };

  const result = parseExpr();
  if (pos < tokens.length) throw new Error("Unexpected trailing input");
  return result;
}

/** Format a numeric result the way a calculator display should. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Number(value.toPrecision(12));
  const magnitude = Math.abs(rounded);
  if (magnitude !== 0 && (magnitude >= 1e15 || magnitude < 1e-9)) {
    return rounded.toExponential(6).replace(/\.?0+e/, "e");
  }
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

/**
 * Auto-close unbalanced parentheses so a partially-typed expression can still
 * be evaluated ("2×(3+4" → "2×(3+4)").
 */
export function autoCloseParens(expression: string): string {
  let open = 0;
  for (const ch of expression) {
    if (ch === "(") open++;
    else if (ch === ")") open--;
  }
  return open > 0 ? expression + ")".repeat(open) : expression;
}

/** Evaluate with automatic parenthesis balancing; throws on invalid input. */
export function evaluateLoose(expression: string, state: EngineState): number {
  return evaluate(autoCloseParens(expression), state);
}
