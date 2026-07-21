import { NextResponse } from "next/server";

import { requireOfficeInDepartment } from "@/lib/office-access";
import {
  buildPlantillaCandidateDepartmentScope,
  buildEmployeePlantillaLinkUpdate,
  buildPlantillaItemNumbers,
  findBioSuffixMatchForItemNumber,
  findEmployeeNameMatch,
  MAX_PLANTILLA_PASTE_ROWS,
  normalizeCreateQuantity,
  normalizeOptionalId,
  normalizePlantillaInput,
  parseOccupantName,
  validateDivisionBelongsToOffice,
  type NormalizedPlantilla,
} from "@/lib/plantilla";
import prismadb from "@/lib/prismadb";
import { publishWorkforceChanged } from "@/lib/workforce-realtime";

const plantillaInclude = {
  officeDivision: { select: { id: true, name: true } },
  employeeType: { select: { id: true, name: true } },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
    },
  },
} as const;

type CreatedPlantilla = {
  id: string;
  officeId: string;
  itemNumber: string | null;
  title: string;
  salaryGrade: number | null;
  employeeTypeId: string | null;
  officeDivisionId: string | null;
};

async function assertDivisionOk(
  departmentId: string,
  officeId: string,
  officeDivisionId: string | null
) {
  if (!officeDivisionId) return null;
  const division = await prismadb.officeDivision.findFirst({
    where: {
      id: officeDivisionId,
      departmentId,
      officeId,
    },
    select: { id: true, officeId: true },
  });
  return validateDivisionBelongsToOffice({ division, officeId });
}

async function assertEmployeeTypeOk(
  departmentId: string,
  employeeTypeId: string | null
) {
  if (!employeeTypeId) return null;
  const employeeType = await prismadb.employeeType.findFirst({
    where: { id: employeeTypeId, departmentId },
    select: { id: true },
  });
  if (!employeeType) {
    return "Status (employee type) not found in this department";
  }
  return null;
}

function createPlantillaData(
  departmentId: string,
  officeId: string,
  value: Pick<
    NormalizedPlantilla,
    | "itemNumber"
    | "title"
    | "salaryGrade"
    | "officeDivisionId"
    | "employeeTypeId"
    | "isActive"
  > & { itemNumber: string | null }
) {
  return {
    department: { connect: { id: departmentId } },
    office: { connect: { id: officeId } },
    ...(value.officeDivisionId
      ? { officeDivision: { connect: { id: value.officeDivisionId } } }
      : {}),
    ...(value.employeeTypeId
      ? { employeeType: { connect: { id: value.employeeTypeId } } }
      : {}),
    itemNumber: value.itemNumber,
    title: value.title,
    salaryGrade: value.salaryGrade,
    salaryStep: null,
    isActive: value.isActive,
  };
}

/**
 * After plantilla rows are created, link unassigned employees by:
 * 1) Emp No suffix matching item number (when present)
 * 2) Else first+last name from optional occupantName on the paste row
 */
async function autoLinkEmployeesAfterCreate(args: {
  departmentId: string;
  created: CreatedPlantilla[];
  occupantNames?: Array<string | null | undefined>;
}): Promise<{ linked: number; warnings: string[] }> {
  if (args.created.length === 0) {
    return { linked: 0, warnings: [] };
  }

  const candidates = await prismadb.employee.findMany({
    where: {
      ...buildPlantillaCandidateDepartmentScope(args.departmentId),
      plantillaPositionId: null,
    },
    select: {
      id: true,
      officeId: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
    },
  });

  let linked = 0;
  const warnings: string[] = [];
  const claimedEmployeeIds = new Set<string>();

  for (let i = 0; i < args.created.length; i++) {
    const plantilla = args.created[i];
    const available = candidates.filter((c) => !claimedEmployeeIds.has(c.id));
    let matchId: string | null = null;
    let linkLabel = "";

    const itemNumber = plantilla.itemNumber?.trim() || null;
    if (itemNumber) {
      const bioCandidates = available.filter((c) =>
        Boolean(c.employeeNo?.includes(","))
      );
      const bio = findBioSuffixMatchForItemNumber(bioCandidates, itemNumber);
      if (bio.kind === "unique") {
        matchId = bio.matchId;
        linkLabel = `Emp No suffix ${itemNumber}`;
      } else if (bio.kind === "ambiguous") {
        warnings.push(
          `${itemNumber}: 2+ employees match Emp No suffix — skipped`
        );
      }
    }

    const occupantName = args.occupantNames?.[i]?.trim() || null;
    if (!matchId && occupantName) {
      const parsed = parseOccupantName(occupantName);
      if (!parsed) {
        warnings.push(`Could not parse name “${occupantName}” — skipped`);
      } else {
        const name = findEmployeeNameMatch(
          available,
          parsed.firstName,
          parsed.lastName
        );
        if (name.kind === "unique") {
          matchId = name.matchId;
          linkLabel = `${parsed.lastName}, ${parsed.firstName}`;
        } else if (name.kind === "ambiguous") {
          warnings.push(
            `${parsed.lastName}, ${parsed.firstName}: 2+ employees match name — skipped`
          );
        }
      }
    }

    if (!matchId) continue;

    const employee = available.find((c) => c.id === matchId);
    if (!employee) continue;

    const data = buildEmployeePlantillaLinkUpdate(plantilla, employee);
    await prismadb.employee.update({
      where: { id: employee.id },
      data,
    });
    claimedEmployeeIds.add(employee.id);
    linked += 1;
    void linkLabel;
  }

  return { linked, warnings };
}

async function reloadPlantillaItems(ids: string[]) {
  return prismadb.plantillaPosition.findMany({
    where: { id: { in: ids } },
    include: plantillaInclude,
    orderBy: [{ itemNumber: "asc" }, { title: "asc" }],
  });
}

export async function GET(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    const url = new URL(req.url);
    const divisionId = normalizeOptionalId(url.searchParams.get("divisionId"));
    const vacantOnly = url.searchParams.get("vacantOnly") === "true";
    const activeOnly = url.searchParams.get("activeOnly") !== "false";
    const status = url.searchParams.get("status"); // vacant | filled | all

    const items = await prismadb.plantillaPosition.findMany({
      where: {
        departmentId: params.departmentId,
        officeId: params.officeId,
        ...(divisionId ? { officeDivisionId: divisionId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
        ...(vacantOnly || status === "vacant"
          ? { employee: null }
          : status === "filled"
            ? { employee: { isNot: null } }
            : {}),
      },
      orderBy: [{ itemNumber: "asc" }, { title: "asc" }],
      include: {
        officeDivision: { select: { id: true, name: true } },
        employeeType: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            employeeNo: true,
          },
        },
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const access = await requireOfficeInDepartment(params.departmentId, params.officeId);
    if (access.error) return access.error;

    const body = await req.json();

    // Bulk paste create: { items: [...] }
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) {
        return NextResponse.json({ error: "Paste list is empty" }, { status: 400 });
      }
      if (body.items.length > MAX_PLANTILLA_PASTE_ROWS) {
        return NextResponse.json(
          { error: `Paste is limited to ${MAX_PLANTILLA_PASTE_ROWS} rows` },
          { status: 400 }
        );
      }

      const normalizedRows: NormalizedPlantilla[] = [];
      for (let i = 0; i < body.items.length; i++) {
        const row = body.items[i];
        const normalized = normalizePlantillaInput({
          itemNumber: row?.itemNumber ?? null,
          title: row?.title,
          salaryGrade: row?.salaryGrade,
          salaryStep: null,
          officeDivisionId: row?.officeDivisionId,
          employeeTypeId: row?.employeeTypeId,
          isActive: row?.isActive,
        });
        if (normalized.error || !normalized.value) {
          return NextResponse.json(
            { error: `Row ${i + 1}: ${normalized.error ?? "Invalid row"}` },
            { status: 400 }
          );
        }
        normalizedRows.push(normalized.value);
      }

      const pasteItemNumbers = normalizedRows
        .map((r) => r.itemNumber)
        .filter((n): n is string => Boolean(n));
      const seenItemNumbers = new Set<string>();
      for (const itemNumber of pasteItemNumbers) {
        const key = itemNumber.toLowerCase();
        if (seenItemNumbers.has(key)) {
          return NextResponse.json(
            { error: `Duplicate item number in paste: ${itemNumber}` },
            { status: 400 }
          );
        }
        seenItemNumbers.add(key);
      }
      if (pasteItemNumbers.length) {
        const duplicateItem = await prismadb.plantillaPosition.findFirst({
          where: {
            departmentId: params.departmentId,
            OR: pasteItemNumbers.map((itemNumber) => ({
              itemNumber: { equals: itemNumber, mode: "insensitive" as const },
            })),
          },
          select: { id: true, itemNumber: true },
        });
        if (duplicateItem) {
          return NextResponse.json(
            {
              error: `Item number already exists in this department${
                duplicateItem.itemNumber ? `: ${duplicateItem.itemNumber}` : ""
              }`,
            },
            { status: 400 }
          );
        }
      }

      const divisionIds = [
        ...new Set(
          normalizedRows
            .map((r) => r.officeDivisionId)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      for (const divisionId of divisionIds) {
        const divisionError = await assertDivisionOk(
          params.departmentId,
          params.officeId,
          divisionId
        );
        if (divisionError) {
          return NextResponse.json({ error: divisionError }, { status: 400 });
        }
      }

      const typeIds = [
        ...new Set(
          normalizedRows
            .map((r) => r.employeeTypeId)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      for (const typeId of typeIds) {
        const typeError = await assertEmployeeTypeOk(params.departmentId, typeId);
        if (typeError) {
          return NextResponse.json({ error: typeError }, { status: 400 });
        }
      }

      const created = await prismadb.$transaction(
        normalizedRows.map((value) =>
          prismadb.plantillaPosition.create({
            data: createPlantillaData(params.departmentId, params.officeId, value),
            select: {
              id: true,
              officeId: true,
              itemNumber: true,
              title: true,
              salaryGrade: true,
              employeeTypeId: true,
              officeDivisionId: true,
            },
          })
        )
      );

      const occupantNames = body.items.map(
        (row: { occupantName?: string | null }) =>
          typeof row?.occupantName === "string" ? row.occupantName : null
      );

      const { linked, warnings } = await autoLinkEmployeesAfterCreate({
        departmentId: params.departmentId,
        created,
        occupantNames,
      });

      const items = await reloadPlantillaItems(created.map((c) => c.id));

      await publishWorkforceChanged(params.departmentId, {
        scope: "plantilla",
        action: "created",
      });
      return NextResponse.json(
        { count: items.length, items, linked, warnings },
        { status: 201 }
      );
    }

    const normalized = normalizePlantillaInput(body);
    if (normalized.error || !normalized.value) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const value = normalized.value;
    const divisionError = await assertDivisionOk(
      params.departmentId,
      params.officeId,
      value.officeDivisionId
    );
    if (divisionError) {
      return NextResponse.json({ error: divisionError }, { status: 400 });
    }

    const quantityResult = normalizeCreateQuantity(body.quantity);
    if (quantityResult.error || !quantityResult.quantity) {
      return NextResponse.json({ error: quantityResult.error }, { status: 400 });
    }
    const quantity = quantityResult.quantity;

    const typeError = await assertEmployeeTypeOk(
      params.departmentId,
      value.employeeTypeId
    );
    if (typeError) {
      return NextResponse.json({ error: typeError }, { status: 400 });
    }

    const itemNumbers = buildPlantillaItemNumbers(value.itemNumber, quantity);
    const numbered = itemNumbers.filter((n): n is string => Boolean(n));
    if (numbered.length) {
      const duplicateItem = await prismadb.plantillaPosition.findFirst({
        where: {
          departmentId: params.departmentId,
          OR: numbered.map((itemNumber) => ({
            itemNumber: { equals: itemNumber, mode: "insensitive" as const },
          })),
        },
        select: { id: true, itemNumber: true },
      });
      if (duplicateItem) {
        return NextResponse.json(
          {
            error: `Item number already exists in this department${
              duplicateItem.itemNumber ? `: ${duplicateItem.itemNumber}` : ""
            }`,
          },
          { status: 400 }
        );
      }
    }

    const created = await prismadb.$transaction(
      itemNumbers.map((itemNumber) =>
        prismadb.plantillaPosition.create({
          data: createPlantillaData(params.departmentId, params.officeId, {
            ...value,
            itemNumber,
          }),
          select: {
            id: true,
            officeId: true,
            itemNumber: true,
            title: true,
            salaryGrade: true,
            employeeTypeId: true,
            officeDivisionId: true,
          },
        })
      )
    );

    const { linked, warnings } = await autoLinkEmployeesAfterCreate({
      departmentId: params.departmentId,
      created,
    });

    const items = await reloadPlantillaItems(created.map((c) => c.id));

    await publishWorkforceChanged(params.departmentId, {
      scope: "plantilla",
      action: "created",
    });
    if (quantity === 1) {
      return NextResponse.json(
        linked > 0 || warnings.length
          ? { ...items[0], linked, warnings }
          : items[0],
        { status: 201 }
      );
    }

    return NextResponse.json(
      { count: items.length, items, linked, warnings },
      { status: 201 }
    );
  } catch (error) {
    console.log("[OFFICE_PLANTILLA_POST]", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    const short =
      typeof message === "string" && message.includes("Argument `")
        ? "Could not create plantilla item. Check required fields and try again."
        : message.length > 240
          ? "Internal Error"
          : message;
    return NextResponse.json({ error: short }, { status: 500 });
  }
}
