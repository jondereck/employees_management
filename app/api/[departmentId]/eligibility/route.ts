

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

    const { name, eligibilityTypes, value } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });

    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 })
    }
    if (!value) {
      return new NextResponse("Color value is required", { status: 400 })
    }

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

    const alreadyExist = await prismadb.eligibility.findFirst({
      where: {
        departmentId:params.departmentId,
        name: name
      },
    });
    
    if (alreadyExist) {
      return new NextResponse(
        JSON.stringify({ error: " Eligibility with this type already exists." }),
        { status: 400 }
      );
    }

   
    const eligibility = await prismadb.eligibility.create({
      data: {
        departmentId: params.departmentId,
        name,
        eligibilityTypes,
        value,

      }
    })

    return NextResponse.json(eligibility)

  } catch (error) {
    console.log('[ELIGIBILITY_POST]', error);
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

    const eligibility = await prismadb.eligibility.findMany({
      where: {
        departmentId: params.departmentId,
      },
    })

    return NextResponse.json(eligibility)

  } catch (error) {
    console.log('[ELIGIBILITY_GET]', error);
    return new NextResponse("Internal error", { status: 500 })
  }
}