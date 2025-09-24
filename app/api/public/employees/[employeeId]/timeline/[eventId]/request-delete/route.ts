import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function POST(_req: Request, { params }: { params: { employeeId: string; eventId: string } }) {
  try {
    const emp = await prismadb.employee.findUnique({
      where: { id: params.employeeId },
      select: { id: true, departmentId: true, publicEnabled: true },
    });
    if (!emp?.publicEnabled) return NextResponse.json({ error: "Public suggestions disabled" }, { status: 403 });

    const event = await prismadb.employmentEvent.findFirst({
      where: { id: params.eventId, employeeId: emp.id },
      select: { id: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await prismadb.changeRequest.create({
      data: {
        departmentId: emp.departmentId,
        employeeId: emp.id,
        entityType: "TIMELINE",
        entityId: event.id,
        action: "DELETE",
        status: "PENDING",
        newValues: {},
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PUBLIC_TIMELINE_REQUEST_DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
