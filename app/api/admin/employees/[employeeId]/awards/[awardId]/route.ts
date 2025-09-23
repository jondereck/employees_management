import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

type Params = { params: { employeeId: string; awardId: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { employeeId, awardId } = params;
    if (!employeeId || !awardId) {
      return new NextResponse("employeeId & awardId required", { status: 400 });
    }

    const body = await req.json();
    // Quick-path fields we can support with current schema:
    // title (string), date (yyyy-mm-dd) -> givenAt, description (optional)
    const title = (body.title ?? "").trim();
    const date = (body.date ?? "").trim();
    const description = body.description?.trim() || null;

    if (!title) return new NextResponse("Title required", { status: 400 });
    if (!date) return new NextResponse("Date required", { status: 400 });

    const givenAt = new Date(date);
    if (isNaN(givenAt.getTime())) {
      return new NextResponse("Invalid date", { status: 400 });
    }

    // make sure the award belongs to the employee
    const found = await prismadb.award.findFirst({
      where: { id: awardId, employeeId },
      select: { id: true },
    });
    if (!found) return new NextResponse("Not found", { status: 404 });

    const updated = await prismadb.award.update({
      where: { id: awardId },
      data: { title, givenAt, description },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return new NextResponse(e.message ?? "Server error", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { employeeId, awardId } = params;
    if (!employeeId || !awardId) {
      return new NextResponse("employeeId & awardId required", { status: 400 });
    }

    // ownership check
    const found = await prismadb.award.findFirst({
      where: { id: awardId, employeeId },
      select: { id: true },
    });
    if (!found) return new NextResponse("Not found", { status: 404 });

    await prismadb.award.delete({ where: { id: awardId } });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return new NextResponse(e.message ?? "Server error", { status: 500 });
  }
}
