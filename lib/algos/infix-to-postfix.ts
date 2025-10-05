//types
export type Token =
  | { type: "num"; value: string }
  | { type: "id"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "lparen" }
  | { type: "rparen" };

//helpers
const isWhitespace = (c: string) => /\s/.test(c);
const isDigit = (c: string) => /[0-9]/.test(c);
const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdPart = (c: string) => /[A-Za-z0-9_]/.test(c);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const push = (t: Token) => tokens.push(t);

  while (i < input.length) {
    const c = input[i];

    if (isWhitespace(c)) {
      i++;
      continue;
    }

    // number (integer or decimal)
    if (isDigit(c) || (c === "." && i + 1 < input.length && isDigit(input[i + 1]))) {
      let start = i;
      i++;
      while (i < input.length && (isDigit(input[i]) || input[i] === ".")) i++;
      push({ type: "num", value: input.slice(start, i) });
      continue;
    }

    // identifier
    if (isIdStart(c)) {
      let start = i;
      i++;
      while (i < input.length && isIdPart(input[i])) i++;
      push({ type: "id", value: input.slice(start, i) });
      continue;
    }

    // parentheses
    if (c === "(") {
      push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      push({ type: "rparen" });
      i++;
      continue;
    }

    // operators
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^") {
      push({ type: "op", value: c });
      i++;
      continue;
    }

    throw new Error(`Unrecognized character "${c}" at position ${i + 1}`);
  }

  // Handle unary minus by inserting a 0 before it when it appears in unary position
  // Unary position: at start, after '(', or after another operator
  const out: Token[] = [];
  for (let j = 0; j < tokens.length; j++) {
    const t = tokens[j];
    if (
      t.type === "op" &&
      t.value === "-" &&
      (
        j === 0 ||
        tokens[j - 1].type === "lparen" ||
        (tokens[j - 1].type === "op")
      )
    ) {
      // insert 0 before the unary minus to make it binary: 0 <expr>
      out.push({ type: "num", value: "0" });
      out.push(t); // '-'
    } else {
      out.push(t);
    }
  }

  return out;
}

const precedence: Record<string, number> = {
  "^": 4,
  "*": 3,
  "/": 3,
  "+": 2,
  "-": 2,
};
const rightAssoc = new Set<string>(["^"]);

export function infixToPostfix(input: string): string {
  const tokens = tokenize(input);
  const output: string[] = [];
  const ops: Token[] = [];

  const flushWhile = (predicate: (top: Token) => boolean) => {
    while (ops.length && predicate(ops[ops.length - 1])) {
      const t = ops.pop()!;
      if (t.type === "op") output.push(t.value);
    }
  };

  for (const t of tokens) {
    if (t.type === "num" || t.type === "id") {
      output.push(t.value);
    } else if (t.type === "op") {
      flushWhile((top) => {
        if (top.type !== "op") return false;
        const pTop = precedence[top.value];
        const pCur = precedence[t.value];
        if (pTop > pCur) return true;
        if (pTop === pCur && !rightAssoc.has(t.value)) return true; // left-assoc
        return false;
      });
      ops.push(t);
    } else if (t.type === "lparen") {
      ops.push(t);
    } else if (t.type === "rparen") {
      // pop until left paren
      let found = false;
      while (ops.length) {
        const top = ops.pop()!;
        if (top.type === "lparen") {
          found = true;
          break;
        }
        if (top.type === "op") output.push(top.value);
      }
      if (!found) throw new Error("Mismatched parentheses.");
    }
  }

  // drain operators
  while (ops.length) {
    const top = ops.pop()!;
    if (top.type === "lparen" || top.type === "rparen") {
      throw new Error("Mismatched parentheses.");
    }
    if (top.type === "op") output.push(top.value);
  }

  return output.join(" ");
}
