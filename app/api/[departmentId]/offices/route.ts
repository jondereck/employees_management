

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

    const { name, billboardId } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });

    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 })
    }
    if (!billboardId) {
      return new NextResponse("BillboardId is required", { status: 400 })
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


    const office = await prismadb.offices.create({
      data: {
        departmentId: params.departmentId,
        name,
        billboardId,

      }
    })

    return NextResponse.json(office)

  } catch (error) {
    console.log('[OFFICE_POST]', error);
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

    const office = await prismadb.offices.findMany({
      where: {
        departmentId: params.departmentId,
      },
    })

    return NextResponse.json(office)

  } catch (error) {
    console.log('[OFFICE_GET]', error);
    return new NextResponse("Internal error", { status: 500 })
  }
}