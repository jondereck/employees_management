// lib/algos/randomInfix.ts
type GenOpts = {
  maxDepth?: number;        // recursion depth of expression tree
  allowPow?: boolean;       // include ^
  allowUnaryMinus?: boolean;
  numberChance?: number;    // 0..1 chance an operand is a number vs identifier
};

const VAR_POOL = [
  "A","B","C","D","E",
  "x","y","z","x1","x2","y1","y2",
  "rate","bonus","salary"
];

const OPS_BASE = ["+","-","*","/"] as const;
const OPS_WITH_POW = ["+","-","*","/","^"] as const;

function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[ri(0, arr.length - 1)];
}
function p(prob: number) {
  return Math.random() < prob;
}

function genNumber(): string {
  // integers 1..20, sometimes a 1-decimal float
  if (p(0.25)) {
    const base = ri(1, 20);
    const frac = ri(1, 9);
    return `${base}.${frac}`;
  }
  return `${ri(1, 20)}`;
}

function genIdentifier(): string {
  return pick(VAR_POOL);
}

function genOperand(opts: Required<GenOpts>, depth: number): string {
  let atom = p(opts.numberChance) ? genNumber() : genIdentifier();

  // Avoid literal 0 by design to sidestep /0 when it randomly pairs with "/"
  if (atom === "0") atom = "1";

  // Optional unary minus
  if (opts.allowUnaryMinus && p(0.18)) {
    // Wrap with parentheses if it’s a composite later; here it’s just atomic
    return `-${atom}`;
  }
  return atom;
}

function genExprRec(opts: Required<GenOpts>, depth: number): string {
  if (depth <= 0 || p(0.2)) {
    return genOperand(opts, depth);
  }

  const ops = opts.allowPow ? OPS_WITH_POW : OPS_BASE;
  const op = pick(ops);
  const left = genExprRec(opts, depth - 1);
  let right = genExprRec(opts, depth - 1);

  // Light guard vs division by a plain 0-like token (we don’t generate "0", but keep safety for "-0" forms)
  if (op === "/") {
    // If right accidentally becomes something dangerous like "-0" (rare),
    // just force a non-zero number.
    if (/^-?0(\.0+)?$/.test(right)) right = "1";
  }

  // Bias: sometimes force parentheses to make nice samples
  const L = p(0.65) ? `(${left})` : left;
  const R = p(0.65) ? `(${right})` : right;

  return `${L} ${op} ${R}`;
}

export function generateRandomInfix(partial?: GenOpts): string {
  const opts: Required<GenOpts> = {
    maxDepth: partial?.maxDepth ?? ri(2, 4),
    allowPow: partial?.allowPow ?? true,
    allowUnaryMinus: partial?.allowUnaryMinus ?? true,
    numberChance: Math.min(Math.max(partial?.numberChance ?? 0.45, 0), 1),
  };

  // Occasionally produce a very “textbook” form like: ((x1 + x2) * (y1 - y2)) / 2
  if (p(0.22)) {
    const a1 = pick(["x","x1","a","p"]);
    const a2 = pick(["x2","b","q"]);
    const b1 = pick(["y","y1","m"]);
    const b2 = pick(["y2","n"]);
    const denom = p(0.6) ? `${ri(2, 9)}` : genIdentifier();
    return `((${a1} + ${a2}) * (${b1} - ${b2})) / ${denom}`;
  }

  return genExprRec(opts, opts.maxDepth);
}
