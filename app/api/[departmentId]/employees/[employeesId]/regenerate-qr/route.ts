import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { randomUUID } from "crypto";

export async function POST(
  _req: Request,
  {
    params,
  }: {
    params: { departmentId: string; employeesId: string };
  }
) {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }



  const employee = await prismadb.employee.update({
    where: { id: params.employeesId }, // ✅ FIX HERE
    data: {
       publicId: randomUUID(),          // ✅ NEW SECRET TOKEN
  publicVersion: { increment: 1 }, // ✅ INVALIDATES OLD QRs
  publicEnabled: true,
    },
    select: {
      id: true,
      publicId: true,
      publicVersion: true,
    },
  });

  return NextResponse.json(employee);
}
