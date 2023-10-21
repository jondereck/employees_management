

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

    const { label, imageUrl } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });

    }

    if (!label) {
      return new NextResponse("Label is required", { status: 400 })
    }
    if (!imageUrl) {
      return new NextResponse("Image url is required", { status: 400 })
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

    const alreadyExist = await prismadb.billboard.findFirst({
      where: {
        departmentId:params.departmentId,
        label: label
      },
    });
    
    if (alreadyExist) {
      return new NextResponse(
        JSON.stringify({ error: " Billboard already exists." }),
        { status: 400 }
      );
    }


	

    const billboard = await prismadb.billboard.create({
      data: {
        departmentId: params.departmentId,
        label,
        imageUrl,

      }
    })

    return NextResponse.json(billboard)

  } catch (error) {
    console.log('[BILLBOARDS_POST]', error);
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

    const billboards = await prismadb.billboard.findMany({
      where: {
        departmentId: params.departmentId,
      },
    })

    return NextResponse.json(billboards)

  } catch (error) {
    console.log('[BILLBOARDS_GET]', error);
    return new NextResponse("Internal error", { status: 500 })
  }
}