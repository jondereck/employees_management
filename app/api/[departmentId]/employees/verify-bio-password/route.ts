import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { password } = body as { password?: string };

    const configured = process.env.BIO_NUMBER_EDIT_PASSWORD;
    if (!configured) {
      return NextResponse.json(
        { error: "Bio edit password is not configured on the server." },
        { status: 500 }
      );
    }

    if (!password || password !== configured) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VERIFY_BIO_PASSWORD]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
