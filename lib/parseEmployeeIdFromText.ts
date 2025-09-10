export type IdGuess = { id: string | null; kind: "uuid" | "number" | "unknown" };

const UUID_STR = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const UUID_RE = new RegExp(UUID_STR, "i");
const NUM_RE = /\b\d{4,}\b/;
const EMP_SEG_RE = new RegExp(`(?:^|/)employee/(${UUID_STR})(?:$|[/?#])`, "i");

export function parseIdFromText(text: string, custom?: RegExp): IdGuess {
  if (!text) return { id: null, kind: "unknown" };
  const s = String(text).trim();

  // 0) Custom regex wins
  if (custom) {
    const m = s.match(custom);
    if (m?.[1]) return { id: m[1], kind: guessKind(m[1]) };
  }

  // 1) Prefer .../employee/<uuid>
  const emp = s.match(EMP_SEG_RE);
  if (emp?.[1]) return { id: emp[1], kind: "uuid" };

  // 2) Prefer query ?employeeId=<uuid> or ?id=<uuid>
  const qp = s.match(new RegExp(`[?&](?:employeeId|id)=(${UUID_STR})`, "i"));
  if (qp?.[1]) return { id: qp[1], kind: "uuid" };

  // 3) Fallback: take the LAST uuid in string (your case has two)
  const all = s.match(new RegExp(UUID_STR, "gi"));
  if (all?.length) return { id: all[all.length - 1], kind: "uuid" };

  // 4) Numeric fallback (employeeNo)
  const n = s.match(NUM_RE)?.[0];
  if (n) return { id: n, kind: "number" };

  return { id: null, kind: "unknown" };
}

function guessKind(id: string): IdGuess["kind"] {
  if (UUID_RE.test(id)) return "uuid";
  if (/^\d+$/.test(id)) return "number";
  return "unknown";
}
