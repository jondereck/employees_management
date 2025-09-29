import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
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
  { params }: { params: { officeId: string } }
) {
  try {
    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

    const office = await prismadb.offices.findUnique({
      where: { id: params.officeId },
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
  _req: Request,
  { params }: { params: { departmentId: string; officeId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
    });
    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const office = await prismadb.offices.delete({
      where: { id: params.officeId },
    });

    return NextResponse.json(office);
  } catch (error) {
    console.log("[OFFICE_DELETE]", error);
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

  return NextResponse.json(updated);
}
