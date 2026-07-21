import {
  buildOfficeDeletionEmployeePatch,
  classifyOfficeDeletionEmployees,
  formatOfficeDeleteBlockedMessage,
  type OfficeReassignment,
  validateOfficeReassignments,
} from "@/lib/office-deletion";
import prismadb from "@/lib/prismadb";
import { publishWorkforceChanged } from "@/lib/workforce-realtime";
import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// =====================
// BIO helper (no DB change; fits VarChar(16))
// =====================
const COLUMN_LIMIT = 16;

/**
 * Accepts:
 *  - string: "A,B2" or "A"
 *  - string[]: ["A","B2"]
 *  - null/undefined: clears
 *
 * Normalizes to uppercase, A-Z/0-9 only, de-dups, CSV-joins.
 * Enforces total length <= 16 (including commas).
 * Returns a CSV string or "" (caller can store null when empty).
 */
function normalizeCodes(input: string | string[] | null | undefined): string {
  const list = Array.isArray(input) ? input : (input ?? "").split(",");
  const codes = list
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  for (const c of codes) {
    if (!/^[A-Z0-9]+$/.test(c)) {
      throw new Error(
        `BIO Index Code "${c}" is invalid. Use letters/numbers only, no spaces.`
      );
    }
    if (c.length > 16) {
      throw new Error(`BIO Index Code "${c}" must be at most 16 characters.`);
    }
  }

  // de-dup, preserve order
  const seen = new Set<string>();
  const unique = codes.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));

  const csv = unique.join(",");
  if (csv.length > COLUMN_LIMIT) {
    throw new Error(
      `Combined BIO Index Codes exceed ${COLUMN_LIMIT} characters (including commas).`
    );
  }
  return csv; // possibly ""
}

// =====================
// GET
// =====================
export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    if (!params.departmentId || !params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

    const office = await prismadb.offices.findFirst({
      where: {
        id: params.officeId,
        departmentId: params.departmentId,
        department: { userId },
      },
      include: { billboard: true },
    });

    if (!office) return new NextResponse("Not Found", { status: 404 });

    return NextResponse.json(office);
  } catch (error) {
    console.log("[OFFICE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// =====================
// PATCH (partial update; supports CSV or array for bioIndexCode)
// =====================
export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

    // Verify the office belongs to the user's department
    const canEdit = await prismadb.offices.findFirst({
      where: {
        id: params.officeId,
        departmentId: params.departmentId,
        department: { userId },
      },
      select: { id: true },
    });
    if (!canEdit) return new NextResponse("Unauthorized", { status: 403 });

    const body = (await req.json()) as {
      name?: string;
      billboardId?: string;
      bioIndexCode?: string | null; // CSV or single string
      bioIndexCodes?: string[];     // optional alternative input
    };

    const updates: Record<string, any> = {};

    // Optional name
    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) return new NextResponse("Name cannot be empty", { status: 400 });
      updates.name = trimmed;
    }

    // Optional billboardId
    if (body.billboardId !== undefined) {
      if (typeof body.billboardId !== "string" || !body.billboardId.trim()) {
        return new NextResponse("Billboard id must be a non-empty string", { status: 400 });
      }
      updates.billboardId = body.billboardId.trim();
    }

    // Optional BIO index code(s)
    if (body.bioIndexCode !== undefined || body.bioIndexCodes !== undefined) {
      try {
        const csv = normalizeCodes(
          Array.isArray(body.bioIndexCodes) ? body.bioIndexCodes : body.bioIndexCode
        );
        updates.bioIndexCode = csv || null; // empty → clear
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return new NextResponse("No valid fields to update", { status: 400 });
    }

    const updated = await prismadb.offices.update({
      where: { id: params.officeId },
      data: updates,
      select: {
        id: true,
        name: true,
        billboardId: true,
        bioIndexCode: true, // may contain CSV (<=16 chars)
        updatedAt: true,
      },
    });

    await publishWorkforceChanged(params.departmentId, {
      scope: "office",
      action: "updated",
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.log("[OFFICE_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// =====================
// DELETE
// =====================
export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  let reassignments: OfficeReassignment[] | undefined;
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

    const rawBody = await req.text();
    if (rawBody.trim()) {
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: "Request body must be valid JSON." },
          { status: 400 }
        );
      }
      const candidate =
        typeof body === "object" && body !== null
          ? (body as { reassignments?: unknown }).reassignments
          : undefined;
      if (
        !Array.isArray(candidate) ||
        !candidate.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as OfficeReassignment).employeeId === "string" &&
            (item as OfficeReassignment).employeeId.length > 0 &&
            typeof (item as OfficeReassignment).officeId === "string" &&
            (item as OfficeReassignment).officeId.length > 0 &&
            ((item as OfficeReassignment).officeDivisionId === undefined ||
              (item as OfficeReassignment).officeDivisionId === null ||
              (typeof (item as OfficeReassignment).officeDivisionId ===
                "string" &&
                (item as OfficeReassignment).officeDivisionId!.length > 0))
        )
      ) {
        return NextResponse.json(
          { error: "Reassignments must contain employee and office IDs." },
          { status: 400 }
        );
      }
      reassignments = candidate as OfficeReassignment[];
    }

    const result = await prismadb.$transaction(async (tx) => {
      const ownedOffice = await tx.offices.findFirst({
        where: {
          id: params.officeId,
          departmentId: params.departmentId,
          department: { userId },
        },
        select: { id: true },
      });
      if (!ownedOffice) return { kind: "forbidden" as const };

      const affectedEmployees = await tx.employee.findMany({
        where: {
          departmentId: params.departmentId,
          OR: [
            { officeId: ownedOffice.id },
            { designationId: ownedOffice.id },
            { officeDivision: { is: { officeId: ownedOffice.id } } },
            { plantillaPosition: { is: { officeId: ownedOffice.id } } },
          ],
        },
        select: {
          id: true,
          officeId: true,
          designationId: true,
          officeDivision: { select: { officeId: true } },
          plantillaPosition: {
            select: { officeId: true },
          },
        },
      });
      const affected = classifyOfficeDeletionEmployees(
        affectedEmployees,
        ownedOffice.id
      );

      if (affected.length > 0 && reassignments === undefined) {
        const blockers = {
          assignedEmployees: affected.filter((employee) =>
            employee.reasons.includes("assigned")
          ).length,
          designatedEmployees: affected.filter((employee) =>
            employee.reasons.includes("designated")
          ).length,
          plantillaOccupants: affected.filter((employee) =>
            employee.reasons.includes("plantilla")
          ).length,
          divisionEmployees: affected.filter((employee) =>
            employee.reasons.includes("division")
          ).length,
        };
        return {
          kind: "blocked" as const,
          error:
            formatOfficeDeleteBlockedMessage(blockers) ??
            "Cannot delete this office while employees use its divisions.",
        };
      }

      if (reassignments !== undefined) {
        const requestedDestinationIds = [
          ...new Set(reassignments.map((item) => item.officeId)),
        ];
        const requestedDivisionIds = [
          ...new Set(
            reassignments
              .map((item) => item.officeDivisionId)
              .filter((id): id is string => id != null)
          ),
        ];
        const [validDestinations, validDestinationDivisions] =
          await Promise.all([
            tx.offices.findMany({
              where: {
                id: { in: requestedDestinationIds, not: ownedOffice.id },
                departmentId: params.departmentId,
              },
              select: { id: true },
            }),
            tx.officeDivision.findMany({
              where: {
                id: { in: requestedDivisionIds },
                departmentId: params.departmentId,
                officeId: { in: requestedDestinationIds },
              },
              select: { id: true, officeId: true },
            }),
          ]);
        const validation = validateOfficeReassignments({
          affectedEmployeeIds: affected.map((employee) => employee.employeeId),
          assignedEmployeeIds: affectedEmployees
            .filter((employee) => employee.officeId === ownedOffice.id)
            .map((employee) => employee.id),
          reassignments,
          validDestinationOfficeIds: validDestinations.map(
            (destination) => destination.id
          ),
          validDestinationDivisions,
          deletingOfficeId: ownedOffice.id,
        });
        if (!validation.ok) {
          return { kind: "validation" as const, validation };
        }

        const reassignmentByEmployee = new Map(
          reassignments.map((item) => [item.employeeId, item])
        );
        for (const employee of affectedEmployees) {
          const reassignment = reassignmentByEmployee.get(employee.id);
          if (!reassignment) continue;
          await tx.employee.update({
            where: { id: employee.id },
            data: buildOfficeDeletionEmployeePatch(
              employee,
              ownedOffice.id,
              reassignment.officeId,
              reassignment.officeDivisionId
            ),
          });
        }
      }

      const office = await tx.offices.delete({
        where: {
          id: ownedOffice.id,
          departmentId: params.departmentId,
        },
      });
      return { kind: "deleted" as const, office };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    });

    if (result.kind === "forbidden") {
      return new NextResponse("Unauthorized", { status: 403 });
    }
    if (result.kind === "blocked") {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    if (result.kind === "validation") {
      return NextResponse.json(result.validation, { status: 409 });
    }

    revalidatePath(`/${params.departmentId}/offices`);
    await publishWorkforceChanged(params.departmentId, {
      scope: "office",
      action: "deleted",
    });
    return NextResponse.json(result.office);
  } catch (error) {
    console.log("[OFFICE_DELETE]", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          code: "STALE_OFFICE_DELETION_PREVIEW",
          error:
            "Office data changed during deletion. Review the refreshed list and try again.",
        },
        { status: 409 }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      reassignments !== undefined &&
      (error.code === "P2003" || error.code === "P2025")
    ) {
      return NextResponse.json(
        {
          code: "STALE_OFFICE_DELETION_PREVIEW",
          error:
            "Office data changed during deletion. Review the refreshed list and try again.",
        },
        { status: 409 }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this office while related records still use it.",
        },
        { status: 409 }
      );
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// =====================
// PUT (replace; accepts single or CSV string)
// =====================
export async function PUT(
  req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

  const body = await req.json();

  let csv: string | null = null;
  try {
    csv = normalizeCodes(body.bioIndexCode);
    csv = csv || null; // empty → clear
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  // Ownership
  const ok = await prismadb.offices.findFirst({
    where: { id: params.officeId, departmentId: params.departmentId, department: { userId } },
    select: { id: true },
  });
  if (!ok) return new NextResponse("Unauthorized", { status: 403 });

  const updated = await prismadb.offices.update({
    where: { id: params.officeId },
    data: { bioIndexCode: csv },
    select: { id: true, name: true, bioIndexCode: true },
  });

  await publishWorkforceChanged(params.departmentId, {
    scope: "office",
    action: "updated",
  });
  return NextResponse.json(updated);
}
