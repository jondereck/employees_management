// lib/bio-utils.ts

/** Extract BIO (digits) and EMP (2nd token) from "8540010, E-4" or "8540010" or "E-4" */
export function splitEmployeeNo(raw?: string | null) {
  const clean = (raw ?? "").trim();
  if (!clean) return { bio: "", emp: "" };

  const [a, b] = clean.split(",").map(s => s.trim());
  // a can be bio (digits) or emp code; we detect
  if (/^\d+$/.test(a)) {
    return { bio: a, emp: b ?? "" };
  }
  // if first token is NOT all digits, then maybe single EMP only
  if (!b) return { bio: "", emp: a };
  // fallback
  return { bio: a, emp: b };
}

/** Get first free number starting from base+1, e.g., base=854000 -> check 854001, 854002, ... */
export function findFirstFreeBio(base: number, usedSet: Set<number>, maxTry = 10000) {
  let candidate = base + 1;
  let attempts = 0;
  while (attempts < maxTry) {
    if (!usedSet.has(candidate)) return String(candidate);
    candidate++;
    attempts++;
  }
  throw new Error("No free BIO found within range");
}


export function derivePrefixAndWidth(indexBaseStr: string) {
  const m = String(indexBaseStr).match(/^(.*?)(0+)$/);
  if (m) {
    const prefix = m[1];
    const width = m[2].length;
    return { prefix, width };
  }
  // no trailing zeros — treat the whole thing as prefix, width 0
  return { prefix: String(indexBaseStr), width: 0 };
}

export function padSuffix(n: number, width: number) {
  return String(n).padStart(width, "0");
}

/** Find first free suffix 1..max for given prefix/width */
export function firstFreeSuffix(usedSuffixes: Set<number>, width: number) {
  const max = width > 0 ? Math.pow(10, width) - 1 : 999999; // sane cap for width 0
  for (let s = 1; s <= max; s++) {
    if (!usedSuffixes.has(s)) return s;
  }
  throw new Error("No free BIO available");
}
