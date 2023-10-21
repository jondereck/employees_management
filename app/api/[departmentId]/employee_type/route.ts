

import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    const body = await req.json()

    const { name, value } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });

    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 })
    }
    // if (!value) {
    //   return new NextResponse("Image url is required", { status: 400 })
    // }

    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
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
    const alreadyExist = await prismadb.employeeType.findFirst({
      where: {
        departmentId:params.departmentId,
        name: name
      },
    });
    
    if (alreadyExist) {
      return new NextResponse(
        JSON.stringify({ error: " Employee with this type already exists." }),
        { status: 400 }
      );
    }


	

    const employeeTypes = await prismadb.employeeType.create({
      data: {
        departmentId: params.departmentId,
        name,
        value,

      }
    })

    return NextResponse.json(employeeTypes)

  } catch (error) {
    console.log('[EMPLOYEE_TYPE_POST]', error);
    return new NextResponse("Internal error", { status: 500 })
  }
}


export async function GET(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {


    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const employeeTypes = await prismadb.employeeType.findMany({
      where: {
        departmentId: params.departmentId,
      },
    })

    return NextResponse.json(employeeTypes)

  } catch (error) {
    console.log('[EMPLOYEE_TYPE_GET]', error);
    return new NextResponse("Internal error", { status: 500 })
  }
}