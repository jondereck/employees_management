import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

/**
 * GET /api/autofill/popular?field=position&limit=8&officeId=abc
 *
 * Returns: string[]
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const field = searchParams.get("field");       // e.g. "position"
  const limit = Number(searchParams.get("limit") ?? 8);
  const officeId = searchParams.get("officeId"); // optional filter

  if (!field) {
    return NextResponse.json({ error: "Missing `field`" }, { status: 400 });
  }

  // Optional filter by officeId if you want:
  const officeFilter = officeId ? { officeId } : {};

  // NOTE: groupBy needs static keys at compile-time, so switch by field
  switch (field) {
    case "position": {
      const grouped = await prismadb.employee.groupBy({
        by: ["position"],
        where: {
          ...officeFilter,
          // Only include rows where the field is NOT null/empty
          position: { not: "" } as any,
        },
        _count: { position: true },
        orderBy: { _count: { position: "desc" } }, // <-- correct typing
        take: limit,
      });

      const values = grouped
        .map(g => g.position)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

      return NextResponse.json(values);
    }

    // Add more fields you want to support here, e.g. eligibility, office, etc.
     case "position": {
      const grouped = await prismadb.employee.groupBy({
        by: ["position"],
        where: {
          ...officeFilter,
          // Only include rows where the field is NOT null/empty
          position: { not: "" } as any,
        },
        _count: { position: true },
        orderBy: { _count: { position: "desc" } }, // <-- correct typing
        take: limit,
      });

      const values = grouped
        .map(g => g.position)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

      return NextResponse.json(values);
    }
    case "city": {
      const grouped = await prismadb.employee.groupBy({
        by: ["city"],
        where: {
          ...officeFilter,
          // Only include rows where the field is NOT null/empty
          city: { not: "" } as any,
        },
        _count: { city: true },
        orderBy: { _count: { city: "desc" } }, // <-- correct typing
        take: limit,
      });

      const values = grouped
        .map(g => g.city)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

      return NextResponse.json(values);
    }
    case "province": {
      const grouped = await prismadb.employee.groupBy({
        by: ["province"],
        where: {
          ...officeFilter,
          // Only include rows where the field is NOT null/empty
          province: { not: "" } as any,
        },
        _count: { province: true },
        orderBy: { _count: { province: "desc" } }, // <-- correct typing
        take: limit,
      });

      const values = grouped
        .map(g => g.province)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

      return NextResponse.json(values);
    }

     case "education": {
      const grouped = await prismadb.employee.groupBy({
        by: ["education"],
        where: {
          ...officeFilter,
          // Only include rows where the field is NOT null/empty
          education: { not: "" } as any,
        },
        _count: { education: true },
        orderBy: { _count: { education: "desc" } }, // <-- correct typing
        take: limit,
      });

      const values = grouped
        .map(g => g.education)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

      return NextResponse.json(values);
    }
     case "street": {
      const grouped = await prismadb.employee.groupBy({
        by: ["street"],
        where: {
          ...officeFilter,
          // Only include rows where the field is NOT null/empty
          street: { not: "" } as any,
        },
        _count: { street: true },
        orderBy: { _count: { street: "desc" } }, // <-- correct typing
        take: limit,
      });

      const values = grouped
        .map(g => g.street)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

      return NextResponse.json(values);
    }
    case "barangay": {
      const grouped = await prismadb.employee.groupBy({
        by: ["barangay"],
        where: {
          ...officeFilter,
          // Only include rows where the field is NOT null/empty
          barangay: { not: "" } as any,
        },
        _count: { barangay: true },
        orderBy: { _count: { barangay: "desc" } }, // <-- correct typing
        take: limit,
      });

      const values = grouped
        .map(g => g.barangay)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

      return NextResponse.json(values);
    }
    // ..

    default:
      return NextResponse.json({ error: `Unsupported field: ${field}` }, { status: 400 });
  }
}
