import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { employeeId: string } }
) {
  // only allow public profiles (optional but recommended)
  const emp = await prismadb.employee.findUnique({
    where: { id: params.employeeId },
    select: { publicEnabled: true },
  });
  if (!emp?.publicEnabled) return NextResponse.json([], { status: 200 });

  const rows = await prismadb.award.findMany({
    where: { employeeId: params.employeeId },
    orderBy: { givenAt: "desc" },
  });

  // Map to the UI shape
  const data = rows.map(r => ({
    id: r.id,
    title: r.title,
    issuer: null,                 // not in schema → null
    date: r.givenAt.toISOString(),
    thumbnail: null,              // not in schema → null
    fileUrl: null,                // not in schema → null
    tags: [] as string[],         // not in schema → []
  }));

  return NextResponse.json(data, { status: 200 });
}
