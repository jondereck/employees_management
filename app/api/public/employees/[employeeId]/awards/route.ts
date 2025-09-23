import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(
  _req: Request,
  { params }: { params: { employeeId: string } }
) {
  // ✅ optional: restrict to employees with public profile
  const emp = await prismadb.employee.findUnique({
    where: { id: params.employeeId },
    select: { publicEnabled: true },
  });
  if (!emp?.publicEnabled) return NextResponse.json([], { status: 200 });

  const rows = await prismadb.award.findMany({
    where: { employeeId: params.employeeId },
    orderBy: { givenAt: "desc" },
  });

  // ✅ Map directly from DB to UI shape
const data = rows.map(r => ({
  id: r.id,
  title: r.title,
  issuer: r.issuer,
  date: r.givenAt.toISOString(),
  thumbnail: r.thumbnail,
  fileUrl: r.fileUrl,
  tags: r.tags ?? [],
  description: r.description,
}));


  return NextResponse.json(data, { status: 200 });
}
