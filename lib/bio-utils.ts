// lib/bio-utils.ts
import prismadb from "@/lib/prismadb";

/**
 * Suggest the smallest available numeric BIO in a range (no suffix).
 * Treats values like "8540001, E-2" as USED for 8540001.
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

  // Pull minimal data
  const rows = await prismadb.employee.findMany({
    where: { departmentId },
    select: { employeeNo: true },
  });

  const used = new Set<number>();

  for (const r of rows) {
    const raw = (r.employeeNo ?? "").trim();
    if (!raw) continue;

    // Get LEFT side before comma (if any), then keep digits only
    // Examples:
    // "8540001, E-2" -> "8540001"
    // "2050000-0007" -> "20500000007" (we'll handle by taking only leading digits)
    // "  8540003  "  -> "8540003"
    const left = raw.split(",")[0] ?? "";
    const digitsOnly = left.replace(/[^\d]/g, "");

    // Keep only LEADING digit run to be safe (prevents "2050000-0007" turning into a huge number)
    const m = digitsOnly.match(/^\d+/);
    if (!m) continue;

    const n = Number(m[0]);
    if (!Number.isFinite(n)) continue;

    // Respect optional family bounds
    if (familyStart != null && n < familyStart) continue;
    if (familyEnd != null && n > familyEnd) continue;

    used.add(n);
  }

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
  