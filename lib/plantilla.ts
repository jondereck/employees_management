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
  isActive?: unknown;
};

export type NormalizedDivision = {
  name: string;
  sortOrder: number;
};

export type NormalizedPlantilla = {
  itemNumber: string;
  title: string;
  salaryGrade: number | null;
  salaryStep: number | null;
  officeDivisionId: string | null;
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
    const itemNumber =
      typeof input.itemNumber === "string" ? input.itemNumber.trim() : "";
    if (!itemNumber) return { error: "Item number is required" };
    if (itemNumber.length > 64) return { error: "Item number must be at most 64 characters" };
    result.itemNumber = itemNumber;
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
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 33) {
        return { error: "Salary grade must be an integer between 1 and 33" };
      }
      result.salaryGrade = n;
    }
  } else if (!partial) {
    result.salaryGrade = null;
  }

  if (input.salaryStep !== undefined) {
    if (input.salaryStep === null || input.salaryStep === "") {
      result.salaryStep = null;
    } else {
      const n = Number(input.salaryStep);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 8) {
        return { error: "Salary step must be an integer between 1 and 8" };
      }
      result.salaryStep = n;
    }
  } else if (!partial) {
    result.salaryStep = null;
  }

  if (input.officeDivisionId !== undefined || !partial) {
    result.officeDivisionId = normalizeOptionalId(input.officeDivisionId);
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
