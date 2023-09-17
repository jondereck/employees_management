import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!params.departmentId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    const department = await prismadb.department.updateMany({
      where: {
        id: params.departmentId,
        userId
      },
      data: {
        name
      }
    });

    return NextResponse.json(department);

  } catch (error) {
    console.log("[DEPARTMENT_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}


export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.departmentId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    const department = await prismadb.department.deleteMany({
      where: {
        id: params.departmentId,
        userId
      },
    });

    return NextResponse.json(department);

  } catch (error) {
    console.log("[DEPARTMENT_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}