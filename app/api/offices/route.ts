import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

/**
 * GET /api/offices?departmentId=... (optional)
 * returns: { id: string; name: string }[]
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId") ?? undefined;

  const offices = await prismadb.offices.findMany({
    where: departmentId ? { departmentId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(offices);
}
