// lib/bio-utils.ts
import prismadb from "@/lib/prismadb";

/** Uppercase, trim, split comma, A-Z/0-9 only, de-dup (order preserved). */
export function splitBioIndexCSV(input: string | string[] | null | undefined): string[] {
  const list = Array.isArray(input) ? input : (input ?? "").split(",");
  const cleaned = list
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  // validate alnum
  for (const c of cleaned) {
    if (!/^[A-Z0-9]+$/.test(c)) {
      throw new Error(`Invalid BIO Index Code "${c}". Use letters/numbers only (no spaces).`);
    }
    if (c.length > 16) {
      throw new Error(`BIO Index Code "${c}" must be at most 16 characters.`);
    }
  }

  // de-dup preserve order
  const seen = new Set<string>();
  return cleaned.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));
}

/** Extract numeric head BEFORE comma (e.g., "8540001, E-2" → 8540001; "2050000-0007" → 2050000) */
export function numericHead(employeeNo: string): number | null {
  const left = (employeeNo ?? "").split(",")[0] ?? "";
  const digitsOnly = left.replace(/[^\d]/g, "");
  const m = digitsOnly.match(/^\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Build a set of USED numeric employee numbers for a department (optionally bounded to a family range). */
async function loadUsedNumbers(departmentId: string, familyStart: number | null, familyEnd: number | null) {
  const rows = await prismadb.employee.findMany({
    where: { departmentId },
    select: { employeeNo: true },
  });

  const used = new Set<number>();
  for (const r of rows) {
    const n = numericHead(r.employeeNo || "");
    if (n == null) continue;
    if (familyStart != null && n < familyStart) continue;
    if (familyEnd != null && n > familyEnd) continue;
    used.add(n);
  }
  return used;
}

/**
 * Suggest the smallest available numeric BIO in a range (no suffix).
 * Treats values like "8540001, E-2" as USED for 8540001.
 *
 * (Kept for backward compatibility with your existing callers.)
 */
export async function findFirstFreeBioFlat(args: {
  departmentId: string;
  startFrom: number;
  allowStart?: boolean;        // default false -> startFrom+1
  digits?: number | null;      // pad width (optional)
  familyStart?: number | null; // inclusive
  familyEnd?: number | null;   // inclusive
}) {
  const {
    departmentId,
    startFrom,
    allowStart = false,
    digits = null,
    familyStart = null,
    familyEnd = null,
  } = args;

  const used = await loadUsedNumbers(departmentId, familyStart, familyEnd);

  // Find smallest available candidate
  let candidate = allowStart ? startFrom : startFrom + 1;
  if (familyStart != null && candidate < familyStart) candidate = familyStart;

  // advance until free (or out of range)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (familyEnd != null && candidate > familyEnd) {
      throw new Error("No available BIO in the configured range.");
    }
    if (!used.has(candidate)) break;
    candidate++;
  }

  let out = String(candidate);
  if (digits && digits > 0) out = out.padStart(digits, "0");
  return out; // e.g., "8540002"
}

/**
 * NEW: Given one or more office BIO index codes (CSV or array),
 * return one suggestion per code (for UI to pick).
 *
 * - For NUMERIC codes (e.g., "2050000"): we look for the next free value
 *   after that base within the department. Width defaults to the code length.
 * - For NON-numeric codes (e.g., "RHU"): we currently just echo back the code;
 *   you can extend this branch if you later define a rule for alphas.
 */
export async function suggestNextBiosForCodes(args: {
  departmentId: string;
  codes: string | string[] | null | undefined; // CSV or array
  digits?: number | null; // optional global pad; if omitted, numeric code length is used
  // optional per-code family bounds (if you want stricter ranges later)
}) {
  const uniqueCodes = splitBioIndexCSV(args.codes);
  if (uniqueCodes.length === 0) return [];

  // One DB scan only
  const used = await loadUsedNumbers(args.departmentId, null, null);

  const results: { indexCode: string; candidate: string }[] = [];

  for (const code of uniqueCodes) {
    if (/^\d+$/.test(code)) {
      const base = Number(code);
      const width = args.digits && args.digits > 0 ? args.digits : code.length;

      // probe upwards until a free number
      let candidateNum = base + 1;
      while (used.has(candidateNum)) candidateNum++;

      const candidate = String(candidateNum).padStart(width, "0");
      results.push({ indexCode: code, candidate });

      // mark as used in-memory to avoid returning same number for two codes accidentally
      used.add(candidateNum);
    } else {
      // Non-numeric code – no numeric range rule; echo the code (customize as needed)
      results.push({ indexCode: code, candidate: code });
    }
  }

  return results;
}
