import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: { eligibilityId: string } }
) {
  try {

    if (!params.eligibilityId) {
      return new NextResponse("Eligibility id is required", { status: 400 });
    }


    const eligibility = await prismadb.eligibility.findUnique({
      where: {
        id: params.eligibilityId,

      },
    });

    return NextResponse.json(eligibility);

  } catch (error) {
    console.log("[ELIGIBILITY_GET]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string, eligibilityId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { customType, eligibilityTypes, value } = body;

    if (!customType) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!value) {
      return new NextResponse("Value is required", { status: 400 });
    }

    if (!params.eligibilityId) {
      return new NextResponse("Eligibility id is required", { status: 400 });
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

    const eligibility = await prismadb.eligibility.updateMany({
      where: {
        id: params.eligibilityId,
      },
      data: {
        customType,
        eligibilityTypes,
        value,
      }
    });

    return NextResponse.json(eligibility);

  } catch (error) {
    console.log("[ELIGIBILITYID_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}


export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string, eligibilityId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.eligibilityId) {
      return new NextResponse("Eligibility id is required", { status: 400 });
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

    const eligibility = await prismadb.eligibility.delete({
      where: {
        id: params.eligibilityId,

      },
    });

    return NextResponse.json(eligibility);

  } catch (error) {
    console.log("[ELIGIBILITY_ID_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

