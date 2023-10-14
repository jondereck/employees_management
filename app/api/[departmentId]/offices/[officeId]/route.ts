import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: {officeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

 
    const office = await prismadb.offices.findUnique({
      where: {
        id: params.officeId,

      },
    });

    return NextResponse.json(office);

  } catch (error) {
    console.log("[OFFICE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string, officeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, billboardId } = body;

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!billboardId) {
      return new NextResponse("Billboard id is required", { status: 400 });
    }

    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 403 })
    }


    const office = await prismadb.offices.updateMany({
      where: {
        id: params.officeId,
      },
      data: {
        name,
        billboardId
      }
    });

    return NextResponse.json(office);

  } catch (error) {
    console.log("[OFFICE_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}


export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string, officeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const office = await prismadb.offices.delete({
      where: {
        id: params.officeId,

      },
    });

    return NextResponse.json(office);

  } catch (error) {
    console.log("[OFFICE_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

