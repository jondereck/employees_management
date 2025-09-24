import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(_req: Request, { params }: { params: { employeeId: string } }) {
  try {
    const emp = await prismadb.employee.findUnique({
      where: { id: params.employeeId },
      select: { id: true, publicEnabled: true },
    });
    if (!emp || !emp.publicEnabled) {
      // Safe no-data response for private/unknown
      return NextResponse.json([]);
    }

    const awards = await prismadb.award.findMany({
      where: { employeeId: emp.id, deletedAt: null },        // hide soft-deleted
      orderBy: { givenAt: "desc" },
      select: {
        id: true,
        title: true,
        issuer: true,
        givenAt: true,
        thumbnail: true,
        fileUrl: true,
        tags: true,
        description: true,
      },
    });

    return NextResponse.json(awards);
  } catch (e) {
    console.error("[PUBLIC_AWARDS_LIST]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
