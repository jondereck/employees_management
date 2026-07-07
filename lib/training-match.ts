import { createHash } from "crypto";

import prismadb from "@/lib/prismadb";
import { numericHead } from "@/lib/bio-utils";
import type { TrainingImportRow } from "@/lib/training-types";

export type TrainingEmployeeMatch = {
  employeeId: string;
  name: string;
  position: string;
  officeId: string;
  officeName: string;
};

export type EmployeeMatchIndex = {
  byBio: Map<number, TrainingEmployeeMatch>;
  byName: Map<string, TrainingEmployeeMatch>;
};

const NAME_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);

/**
 * Normalize a person name to a "LAST, FIRST" key: uppercase, diacritics
 * stripped (ESCAÑO → ESCANO), punctuation removed, middle initials and
 * suffixes dropped. Used as a fallback when the Bio Number is missing/typo'd.
 */
export function normalizeNameKey(raw: string): string | null {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned.includes(",")) return null;

  const [last, rest] = cleaned.split(",", 2).map((s) => s.trim());
  if (!last || !rest) return null;

  // Drop trailing single-letter middle initials and generational suffixes
  const tokens = rest.split(" ");
  while (tokens.length > 1) {
    const tail = tokens[tokens.length - 1];
    if (tail.length === 1 || NAME_SUFFIXES.has(tail)) tokens.pop();
    else break;
  }
  const first = tokens.join(" ");
  if (!first) return null;

  return `${last}, ${first}`;
}

/**
 * Index every employee in a department two ways in one query:
 * - byBio: numeric head of their BIO number (same convention as
 *   lib/bio-utils.ts numericHead / loadUsedNumbers)
 * - byName: normalized "LAST, FIRST" key, used as fallback when the
 *   sheet's Bio Number is blank or wrong. Ambiguous names (two employees
 *   sharing the same key) are excluded from the name index entirely.
 */
export async function buildEmployeeMatchIndex(departmentId: string): Promise<EmployeeMatchIndex> {
  const employees = await prismadb.employee.findMany({
    where: { departmentId },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      middleName: true,
      suffix: true,
      position: true,
      offices: { select: { id: true, name: true } },
    },
  });

  const byBio = new Map<number, TrainingEmployeeMatch>();
  const byName = new Map<string, TrainingEmployeeMatch>();
  const ambiguousNames = new Set<string>();

  for (const emp of employees) {
    const middleInitial = emp.middleName?.trim()
      ? `${emp.middleName.trim().charAt(0).toUpperCase()}.`
      : "";
    const name = [emp.lastName, ", ", emp.firstName, middleInitial ? ` ${middleInitial}` : "", emp.suffix ? ` ${emp.suffix}` : ""]
      .join("")
      .trim();

    const match: TrainingEmployeeMatch = {
      employeeId: emp.id,
      name: name || emp.employeeNo || "Unnamed",
      position: emp.position || "",
      officeId: emp.offices?.id ?? "",
      officeName: emp.offices?.name ?? "",
    };

    const bio = numericHead(emp.employeeNo || "");
    // If two employees share a BIO number (shouldn't happen, but data can be
    // messy), keep the first match; the rest surface as unmatched for review.
    if (bio != null && !byBio.has(bio)) {
      byBio.set(bio, match);
    }

    const nameKey = normalizeNameKey(`${emp.lastName}, ${emp.firstName}`);
    if (nameKey) {
      if (byName.has(nameKey)) {
        ambiguousNames.add(nameKey);
      } else {
        byName.set(nameKey, match);
      }
    }
  }

  for (const key of ambiguousNames) byName.delete(key);

  return { byBio, byName };
}

/** Resolve one sheet row against the index: BIO number first, then name fallback. */
export function resolveEmployeeForRow(
  index: EmployeeMatchIndex,
  row: Pick<TrainingImportRow, "bioNumberRaw" | "nameRaw">
): { match: TrainingEmployeeMatch | undefined; matchedBy: "bio" | "name" | null } {
  const bio = parseBioNumberCell(row.bioNumberRaw);
  const bioMatch = bio != null ? index.byBio.get(bio) : undefined;
  if (bioMatch) return { match: bioMatch, matchedBy: "bio" };

  const nameKey = normalizeNameKey(row.nameRaw);
  const nameMatch = nameKey ? index.byName.get(nameKey) : undefined;
  if (nameMatch) return { match: nameMatch, matchedBy: "name" };

  return { match: undefined, matchedBy: null };
}

/**
 * @deprecated Use buildEmployeeMatchIndex + resolveEmployeeForRow, which also
 * falls back to name matching. Kept for any external callers.
 */
export async function matchEmployeesByBioNumber(
  departmentId: string
): Promise<Map<number, TrainingEmployeeMatch>> {
  const { byBio } = await buildEmployeeMatchIndex(departmentId);
  return byBio;
}

/** Parse a raw "Bio Number" cell (may be a number, numeric string, or messy text) into its numeric head. */
export function parseBioNumberCell(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return numericHead(String(value));
}

/**
 * Stable dedupe key for a training row, so re-uploading an updated export
 * doesn't create duplicate Training records for rows already imported.
 *
 * Includes nameRaw (not just bioNumberRaw) because some source rows have a
 * blank Bio Number — without the name, several different people who attended
 * the same training on the same date from the same provider would hash to the
 * same key and overwrite each other on import.
 */
export function buildSourceRowHash(
  row: Pick<TrainingImportRow, "bioNumberRaw" | "nameRaw" | "certificateTitle" | "dateStart" | "provider">
): string {
  const key = [
    row.bioNumberRaw.trim(),
    row.nameRaw.trim().toLowerCase(),
    row.certificateTitle.trim().toLowerCase(),
    row.dateStart,
    row.provider.trim().toLowerCase(),
  ].join("|");
  return createHash("sha1").update(key).digest("hex");
}
