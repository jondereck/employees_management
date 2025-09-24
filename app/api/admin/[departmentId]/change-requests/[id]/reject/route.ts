import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prismadb";

export async function POST(_req: Request, { params }: { params: { departmentId: string; id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cr = await prisma.changeRequest.update({
    where: { id: params.id },
    data: { status: "REJECTED", reviewedAt: new Date(), approvedById: userId },
  });

  // TODO: notify requester/admins if needed

  return NextResponse.json({ ok: true });
}
