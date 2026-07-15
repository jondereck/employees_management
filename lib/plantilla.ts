/**
 * Shared validation helpers for OfficeDivision + PlantillaPosition.
 * Pure functions — safe to unit test without Prisma.
 */

export type DivisionInput = {
  name?: unknown;
  sortOrder?: unknown;
};

export type PlantillaInput = {
  itemNumber?: unknown;
  title?: unknown;
  salaryGrade?: unknown;
  salaryStep?: unknown;
  officeDivisionId?: unknown;
  employeeTypeId?: unknown;
  isActive?: unknown;
};

export type NormalizedDivision = {
  name: string;
  sortOrder: number;
};

/** Matches salary table ceiling used elsewhere in the app. */
export const MAX_PLANTILLA_SALARY_GRADE = 33;

/** Max identical plantilla slots that can be created in one submit. */
export const MAX_PLANTILLA_CREATE_QUANTITY = 10;

/** Max rows accepted from a bulk paste into Add plantilla. */
export const MAX_PLANTILLA_PASTE_ROWS = 50;

export type EmployeeTypeMatchOption = {
  id: string;
  name: string;
  value?: string | null;
};

export type ParsedPlantillaPasteRow = {
  itemNumber: string | null;
  title: string;
  salaryGrade: number | null;
  statusLabel: string | null;
  /** Set when salary grade token is present but invalid. */
  error?: string;
};

/** Normalize appointment-status labels for loose equality matching. */
export function normalizeStatusKey(label: string): string {
  return label.trim().toLowerCase().replace(/[\s\-_./]+/g, "");
}

/** Collapse common spelling variants onto one canonical key. */
export function canonicalizeStatusKey(label: string): string {
  const key = normalizeStatusKey(label);
  if (!key) return "";
  // Co-Terminus / Coterminus / Coterminous → coterminus
  if (key === "coterminous" || key === "coterminuos") return "coterminus";
  return key;
}

/**
 * Match a pasted status label to an EmployeeType id (name, then value).
 * Hyphens/spaces ignored: "Co-Terminus" matches DB "Coterminus".
 * Also tries the first token so "Elected Jose…" can match "Elected".
 */
export function matchEmployeeTypeId(
  label: string | null | undefined,
  types: EmployeeTypeMatchOption[]
): string | null {
  if (!label?.trim()) return null;

  const keys = new Set<string>();
  const full = canonicalizeStatusKey(label);
  if (full) keys.add(full);
  const firstToken = label.trim().split(/[\s,]+/)[0] ?? "";
  const firstKey = canonicalizeStatusKey(firstToken);
  if (firstKey) keys.add(firstKey);

  if (keys.size === 0) return null;

  for (const t of types) {
    const nameKey = canonicalizeStatusKey(t.name);
    const valueKey = t.value ? canonicalizeStatusKey(t.value) : "";
    for (const key of keys) {
      if (nameKey && nameKey === key) return t.id;
      if (valueKey && valueKey === key) return t.id;
    }
  }
  return null;
}

function splitPasteColumns(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parts: string[];
  if (trimmed.includes("\t")) {
    parts = trimmed
      .split("\t")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  } else {
    parts = trimmed
      .split(/\s{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
  if (parts.length < 2) return null;
  return parts;
}

function parseSgToken(token: string): {
  salaryGrade: number | null;
  error?: string;
} {
  if (!/^\d+$/.test(token)) {
    return { salaryGrade: null };
  }
  const n = Number(token);
  if (
    !Number.isFinite(n) ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > MAX_PLANTILLA_SALARY_GRADE
  ) {
    return {
      salaryGrade: null,
      error: `Salary grade must be between 1 and ${MAX_PLANTILLA_SALARY_GRADE}`,
    };
  }
  return { salaryGrade: n };
}

/**
 * Parse one paste line.
 * Supported shapes (tab or 2+ spaces):
 * - Title | SG | Status
 * - ItemNo | Title | SG | Status
 * - ItemNo | Title | SG
 * - Title | Status (no SG)
 */
function parsePasteLine(line: string): ParsedPlantillaPasteRow | null {
  const parts = splitPasteColumns(line);
  if (!parts) return null;

  let itemNumber: string | null = null;
  let title = "";
  let salaryGrade: number | null = null;
  let statusLabel: string | null = null;
  let error: string | undefined;

  // ItemNo | Title | SG | Status…
  if (parts.length >= 4 && /^\d+$/.test(parts[2])) {
    itemNumber = parts[0];
    title = parts[1];
    const sg = parseSgToken(parts[2]);
    salaryGrade = sg.salaryGrade;
    error = sg.error;
    statusLabel = parts.slice(3).join(" ").trim() || null;
  }
  // ItemNo | Title | SG (no status) — title must not look like a plain SG token
  else if (
    parts.length === 3 &&
    /^\d+$/.test(parts[2]) &&
    !/^\d+$/.test(parts[1])
  ) {
    itemNumber = parts[0];
    title = parts[1];
    const sg = parseSgToken(parts[2]);
    salaryGrade = sg.salaryGrade;
    error = sg.error;
  }
  // Title | SG | Status…
  else if (/^\d+$/.test(parts[1])) {
    title = parts[0];
    const sg = parseSgToken(parts[1]);
    salaryGrade = sg.salaryGrade;
    error = sg.error;
    statusLabel = parts.slice(2).join(" ").trim() || null;
  }
  // Title | Status (no SG)
  else {
    title = parts[0];
    statusLabel = parts.slice(1).join(" ").trim() || null;
  }

  if (!title.trim()) return null;

  const trimmedItemNumber = itemNumber?.trim() || null;
  if (trimmedItemNumber && trimmedItemNumber.length > 64) {
    error = error ?? "Item number must be at most 64 characters";
  }

  return {
    itemNumber: trimmedItemNumber,
    title: title.trim(),
    salaryGrade,
    statusLabel,
    ...(error ? { error } : {}),
  };
}

/**
 * Detect Excel/Word-style plantilla paste (optional ItemNo / Title / SG / Status).
 * Plain single-line titles without column split stay in "plain" mode.
 */
export function parsePlantillaPaste(text: string): {
  mode: "plain" | "bulk";
  rows: ParsedPlantillaPasteRow[];
  error?: string;
} {
  const normalized = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { mode: "plain", rows: [] };
  }

  const rows: ParsedPlantillaPasteRow[] = [];
  for (const line of lines) {
    const parsed = parsePasteLine(line);
    if (parsed) rows.push(parsed);
  }

  if (rows.length === 0) {
    return { mode: "plain", rows: [] };
  }

  if (rows.length > MAX_PLANTILLA_PASTE_ROWS) {
    return {
      mode: "bulk",
      rows: [],
      error: `Paste is limited to ${MAX_PLANTILLA_PASTE_ROWS} rows`,
    };
  }

  return { mode: "bulk", rows };
}

export function normalizeCreateQuantity(value: unknown): {
  quantity?: number;
  error?: string;
} {
  if (value === undefined || value === null || value === "") {
    return { quantity: 1 };
  }
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > MAX_PLANTILLA_CREATE_QUANTITY
  ) {
    return {
      error: `Quantity must be an integer between 1 and ${MAX_PLANTILLA_CREATE_QUANTITY}`,
    };
  }
  return { quantity: n };
}

/**
 * Build item numbers for multi-create.
 * quantity=1 keeps the base as-is (including null).
 * quantity>1 with a base uses `${base}-1` … `${base}-N`.
 * quantity>1 with empty base yields all null (Casual slots).
 */
export function buildPlantillaItemNumbers(
  base: string | null,
  quantity: number
): Array<string | null> {
  if (quantity < 1) return [];
  if (quantity === 1) return [base];
  if (!base) {
    return Array.from({ length: quantity }, () => null);
  }
  return Array.from({ length: quantity }, (_, index) => `${base}-${index + 1}`);
}

export type NormalizedPlantilla = {
  itemNumber: string | null;
  title: string;
  salaryGrade: number | null;
  salaryStep: number | null;
  officeDivisionId: string | null;
  employeeTypeId: string | null;
  isActive: boolean;
};

export function normalizeOptionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === "" || value === "none") {
    return null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeDivisionInput(
  input: DivisionInput,
  options: { requireName?: boolean } = {}
): { value?: NormalizedDivision; error?: string } {
  const requireName = options.requireName !== false;
  const name =
    typeof input.name === "string" ? input.name.trim() : "";

  if (requireName && !name) {
    return { error: "Division name is required" };
  }

  let sortOrder = 0;
  if (input.sortOrder !== undefined && input.sortOrder !== null && input.sortOrder !== "") {
    const n = Number(input.sortOrder);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return { error: "sortOrder must be a non-negative integer" };
    }
    sortOrder = n;
  }

  if (!name && !requireName) {
    return { value: { name: "", sortOrder } };
  }

  return { value: { name, sortOrder } };
}

export function normalizePlantillaInput(
  input: PlantillaInput,
  options: { partial: true }
): { value?: Partial<NormalizedPlantilla>; error?: string };
export function normalizePlantillaInput(
  input: PlantillaInput,
  options?: { partial?: false }
): { value?: NormalizedPlantilla; error?: string };
export function normalizePlantillaInput(
  input: PlantillaInput,
  options: { partial?: boolean } = {}
): { value?: Partial<NormalizedPlantilla> | NormalizedPlantilla; error?: string } {
  const partial = options.partial === true;
  const result: Partial<NormalizedPlantilla> = {};

  if (input.itemNumber !== undefined || !partial) {
    if (input.itemNumber === null || input.itemNumber === undefined || input.itemNumber === "") {
      result.itemNumber = null;
    } else if (typeof input.itemNumber !== "string") {
      return { error: "Item number is invalid" };
    } else {
      const itemNumber = input.itemNumber.trim();
      if (!itemNumber) {
        result.itemNumber = null;
      } else if (itemNumber.length > 64) {
        return { error: "Item number must be at most 64 characters" };
      } else {
        result.itemNumber = itemNumber;
      }
    }
  }

  if (input.title !== undefined || !partial) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return { error: "Position title is required" };
    if (title.length > 200) return { error: "Position title must be at most 200 characters" };
    result.title = title;
  }

  if (input.salaryGrade !== undefined) {
    if (input.salaryGrade === null || input.salaryGrade === "") {
      result.salaryGrade = null;
    } else {
      const n = Number(input.salaryGrade);
      if (
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n < 1 ||
        n > MAX_PLANTILLA_SALARY_GRADE
      ) {
        return {
          error: `Salary grade must be an integer between 1 and ${MAX_PLANTILLA_SALARY_GRADE}`,
        };
      }
      result.salaryGrade = n;
    }
  } else if (!partial) {
    result.salaryGrade = null;
  }

  // Salary step is no longer collected on plantilla items; keep column nullable for legacy.
  if (input.salaryStep !== undefined) {
    result.salaryStep = null;
  } else if (!partial) {
    result.salaryStep = null;
  }

  if (input.officeDivisionId !== undefined || !partial) {
    result.officeDivisionId = normalizeOptionalId(input.officeDivisionId);
  }

  if (input.employeeTypeId !== undefined || !partial) {
    result.employeeTypeId = normalizeOptionalId(input.employeeTypeId);
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") {
      return { error: "isActive must be a boolean" };
    }
    result.isActive = input.isActive;
  } else if (!partial) {
    result.isActive = true;
  }

  return { value: result as NormalizedPlantilla };
}

/**
 * Dual-read display helpers for exports / lists.
 * Prefer structured plantilla/division; fall back to legacy designation/position.
 */
/** Split "8540005, Z-39" → { prefix: "8540005", suffix: "Z-39" }. */
export function splitEmployeeBio(raw?: string | null): {
  prefix: string;
  suffix: string;
} {
  const clean = (raw ?? "").trim();
  if (!clean) return { prefix: "", suffix: "" };
  const comma = clean.indexOf(",");
  if (comma === -1) {
    return { prefix: clean, suffix: "" };
  }
  return {
    prefix: clean.slice(0, comma).trim(),
    suffix: clean.slice(comma + 1).trim(),
  };
}

/** First BIO index code from an office field (may be CSV). */
function firstOfficeBioCode(officeBioIndexCode?: string | null): string {
  return (
    (officeBioIndexCode ?? "")
      .split(",")
      .map((s) => s.trim())
      .find(Boolean) ?? ""
  );
}

/**
 * Compose Biometric / ID Number when a plantilla item is selected.
 * Keeps the existing prefix (before comma), or falls back to the assignment
 * office bioIndexCode. Replaces only the post-comma item-number suffix.
 * Returns null when no prefix can be resolved (caller should leave the field as-is).
 *
 * @example composeEmployeeBio({ currentEmployeeNo: "8540005, E-1", itemNumber: "Z-39" })
 * // → "8540005, Z-39"
 */
export function composeEmployeeBio(args: {
  currentEmployeeNo?: string | null;
  officeBioIndexCode?: string | null;
  itemNumber?: string | null;
}): string | null {
  const { prefix: currentPrefix } = splitEmployeeBio(args.currentEmployeeNo);
  const prefix = (
    currentPrefix || firstOfficeBioCode(args.officeBioIndexCode)
  ).trim();
  if (!prefix) return null;

  const item = (args.itemNumber ?? "").trim();
  const p = prefix.toUpperCase();
  if (!item) return p;
  return `${p}, ${item.toUpperCase()}`;
}

export type BioSuffixMatchCandidate = {
  id: string;
  employeeNo?: string | null;
};

export type BioSuffixMatchResult =
  | { kind: "unique"; matchId: string }
  | { kind: "ambiguous" }
  | { kind: "none" };

/**
 * Find unassigned employees whose Emp No suffix matches a plantilla item number
 * (e.g. "1200040, A-1" → "A-1"). Caller should pass only candidates with
 * plantillaPositionId null. Exactly one match → unique; 2+ → ambiguous.
 */
export function findBioSuffixMatchForItemNumber(
  employees: BioSuffixMatchCandidate[],
  itemNumber: string | null | undefined
): BioSuffixMatchResult {
  const target = (itemNumber ?? "").trim().toLowerCase();
  if (!target) return { kind: "none" };

  const matches = employees.filter((emp) => {
    const suffix = splitEmployeeBio(emp.employeeNo).suffix.toLowerCase();
    return Boolean(suffix) && suffix === target;
  });

  if (matches.length === 0) return { kind: "none" };
  if (matches.length > 1) return { kind: "ambiguous" };
  return { kind: "unique", matchId: matches[0].id };
}

export type BioLinkPreviewEmployee = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
};

export type BioLinkPreviewRow = {
  itemNumber: string;
  kind: "unique" | "ambiguous" | "none";
  employee?: BioLinkPreviewEmployee;
};

/**
 * Preview Emp No suffix links for a list of item numbers.
 * One employee is claimed by at most one item number (first wins).
 */
export function previewBioSuffixLinks(
  itemNumbers: Array<string | null | undefined>,
  employees: Array<
    BioSuffixMatchCandidate & {
      employeeNo?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }
  >
): BioLinkPreviewRow[] {
  const claimed = new Set<string>();
  const rows: BioLinkPreviewRow[] = [];

  for (const raw of itemNumbers) {
    const itemNumber = (raw ?? "").trim();
    if (!itemNumber) continue;

    const available = employees.filter((e) => !claimed.has(e.id));
    const result = findBioSuffixMatchForItemNumber(available, itemNumber);

    if (result.kind === "unique") {
      const emp = available.find((e) => e.id === result.matchId);
      if (emp) claimed.add(emp.id);
      rows.push({
        itemNumber,
        kind: "unique",
        employee: emp
          ? {
              id: emp.id,
              employeeNo: emp.employeeNo ?? "",
              firstName: emp.firstName ?? "",
              lastName: emp.lastName ?? "",
            }
          : undefined,
      });
      continue;
    }

    rows.push({ itemNumber, kind: result.kind });
  }

  return rows;
}

export type PlantillaLinkSyncSource = {
  id: string;
  officeId: string;
  itemNumber: string | null;
  title: string;
  salaryGrade: number | null;
  employeeTypeId: string | null;
  officeDivisionId: string | null;
};

export type EmployeeLinkSyncTarget = {
  id: string;
  officeId: string;
  employeeNo?: string | null;
};

/**
 * Fields to set on an employee when auto-linking to a plantilla item
 * (mirrors employees-form plantilla select effect). Does not change officeId.
 */
export function buildEmployeePlantillaLinkUpdate(
  plantilla: PlantillaLinkSyncSource,
  employee: EmployeeLinkSyncTarget
): {
  plantillaPositionId: string;
  position: string;
  salaryGrade?: number;
  employeeTypeId?: string;
  officeDivisionId?: string | null;
  employeeNo?: string;
} {
  const nextBio = composeEmployeeBio({
    currentEmployeeNo: employee.employeeNo,
    itemNumber: plantilla.itemNumber,
  });

  return {
    plantillaPositionId: plantilla.id,
    position: plantilla.title,
    ...(plantilla.salaryGrade != null ? { salaryGrade: plantilla.salaryGrade } : {}),
    ...(plantilla.employeeTypeId
      ? { employeeTypeId: plantilla.employeeTypeId }
      : {}),
    ...(plantilla.officeId === employee.officeId
      ? { officeDivisionId: plantilla.officeDivisionId }
      : {}),
    ...(nextBio != null ? { employeeNo: nextBio } : {}),
  };
}

export function resolvePlantillaLabel(args: {
  plantillaTitle?: string | null;
  plantillaItemNumber?: string | null;
  designationName?: string | null;
  officeName?: string | null;
}): string {
  const title = args.plantillaTitle?.trim();
  if (title) {
    const item = args.plantillaItemNumber?.trim();
    return item ? `${item} — ${title}` : title;
  }
  const designation = args.designationName?.trim();
  if (designation) return designation;
  return args.officeName?.trim() || "";
}

export type PlantillaSelectOptionInput = {
  id: string;
  officeName: string;
  officeDivisionName?: string | null;
  itemNumber?: string | null;
  title: string;
  salaryGrade?: number | null;
};

function plantillaSelectGroupKey(
  p: Pick<
    PlantillaSelectOptionInput,
    "officeName" | "officeDivisionName" | "itemNumber" | "title"
  >
): string {
  const where = p.officeDivisionName?.trim()
    ? `${p.officeName.trim()} / ${p.officeDivisionName.trim()}`
    : p.officeName.trim();
  const item = p.itemNumber?.trim() || "";
  return `${where}\0${item}\0${p.title.trim()}`.toLowerCase();
}

/** Dropdown label for one plantilla row (employee form Plantilla Item select). */
export function formatPlantillaSelectOptionLabel(
  p: PlantillaSelectOptionInput,
  ctx?: { vacantSlotIndex?: number; vacantSlotTotal?: number }
): string {
  const where = p.officeDivisionName?.trim()
    ? `${p.officeName.trim()} / ${p.officeDivisionName.trim()}`
    : p.officeName.trim();
  const title = p.title.trim();
  const item = p.itemNumber?.trim();

  if (item) {
    return `${where} — ${item} — ${title}`;
  }

  const sg =
    typeof p.salaryGrade === "number" ? `SG ${p.salaryGrade}` : null;
  const needsSlot = (ctx?.vacantSlotTotal ?? 0) > 1;
  const slot =
    needsSlot && ctx?.vacantSlotIndex
      ? `(vacant slot ${ctx.vacantSlotIndex})`
      : null;

  if (sg && slot) {
    return `${where} — ${title} · ${sg} ${slot}`;
  }
  if (slot) {
    return `${where} — ${title} ${slot}`;
  }
  if (sg) {
    return `${where} — ${title} · ${sg}`;
  }
  return `${where} — ${title}`;
}

/** Stable partition: assignment-office plantilla first, preserving source order within each group. */
export function sortPlantillaByAssignmentOffice<T extends { officeId: string }>(
  items: T[],
  assignmentOfficeId?: string | null
): T[] {
  const officeId = assignmentOfficeId?.trim();
  if (!officeId) return items;

  const matching: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    if (item.officeId === officeId) matching.push(item);
    else other.push(item);
  }
  return [...matching, ...other];
}

/** Build value/label pairs for plantilla dropdowns; disambiguates duplicate titles. */
export function buildPlantillaSelectOptions(
  items: PlantillaSelectOptionInput[]
): { value: string; label: string }[] {
  const groups = new Map<string, PlantillaSelectOptionInput[]>();
  for (const p of items) {
    const key = plantillaSelectGroupKey(p);
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const vacantSlotIndex = new Map<string, number>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((p, i) => vacantSlotIndex.set(p.id, i + 1));
  }

  return items.map((p) => {
    const key = plantillaSelectGroupKey(p);
    const group = groups.get(key) ?? [p];
    return {
      value: p.id,
      label: formatPlantillaSelectOptionLabel(p, {
        vacantSlotIndex: vacantSlotIndex.get(p.id),
        vacantSlotTotal: group.length,
      }),
    };
  });
}

export function resolveDivisionLabel(args: {
  divisionName?: string | null;
}): string {
  return args.divisionName?.trim() || "";
}

export function resolvePositionLabel(args: {
  plantillaTitle?: string | null;
  legacyPosition?: string | null;
}): string {
  const structured = args.plantillaTitle?.trim();
  if (structured) return structured;
  return args.legacyPosition?.trim() || "";
}

export type PlantillaOccupancy = {
  id: string;
  officeId: string;
  officeDivisionId: string | null;
  title: string;
  isActive: boolean;
  employee: { id: string } | null;
};

/**
 * Validates that an employee can be assigned to a plantilla item.
 * Plantilla office may differ from assignment office (common LGU pattern).
 * Returns an error message or null when valid.
 */
export function validatePlantillaAssignment(args: {
  plantilla: PlantillaOccupancy | null;
  employeeOfficeId: string;
  employeeDivisionId: string | null;
  employeeId?: string | null;
}): string | null {
  const { plantilla, employeeId } = args;

  if (!plantilla) {
    return "Plantilla position not found in this department";
  }
  if (!plantilla.isActive) {
    return "Cannot assign an inactive plantilla position";
  }
  // Cross-office plantilla is allowed: assignment office != plantilla office.
  // Employee.officeDivisionId is the assignment-office division only and is not
  // required to match PlantillaPosition.officeDivisionId.
  if (plantilla.employee && plantilla.employee.id !== employeeId) {
    return "Plantilla position is already occupied by another employee";
  }
  return null;
}

export function validateDivisionBelongsToOffice(args: {
  division: { id: string; officeId: string } | null;
  officeId: string;
}): string | null {
  if (!args.division) return "Division not found in this office";
  if (args.division.officeId !== args.officeId) {
    return "Division does not belong to the selected office";
  }
  return null;
}
