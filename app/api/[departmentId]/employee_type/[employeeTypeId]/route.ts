import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: {employeeTypeId: string } }
) {
  try {

    if (!params.employeeTypeId) {
      return new NextResponse("Employee Type id is required", { status: 400 });
    }

 
    const employeeTypes = await prismadb.employeeType.findUnique({
      where: {
        id: params.employeeTypeId,

      },
    });

    return NextResponse.json(employeeTypes);

  } catch (error) {
    console.log("[EMPLOYEE_TYPE_ID_GET]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string, employeeTypeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, value } = body;

    if (!name) {
      return new NextResponse("name is required", { status: 400 });
    }

    // if (!value) {
    //   return new NextResponse("Value is required", { status: 400 });
    // }

    if (!params.employeeTypeId) {
      return new NextResponse("Employee type id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 405 })
    }


    const employeeTypes = await prismadb.employeeType.updateMany({
      where: {
        id: params.employeeTypeId,
      },
      data: {
        name,
        value
      }
    });

    return NextResponse.json(employeeTypes);

  } catch (error) {
    console.log("[EMPLOYEE_TYPE_ID_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}


export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string, employeeTypeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.employeeTypeId) {
      return new NextResponse("Employee Type id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 405 })
    }

    const employeeTypes = await prismadb.employeeType.delete({
      where: {
        id: params.employeeTypeId,

      },
    });

    return NextResponse.json(employeeTypes);

  } catch (error) {
    console.log("[EMPLOYEE_TYPE_ID_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

