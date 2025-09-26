import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: {officeId: string } }
) {
  try {

    if (!params.officeId) {
      return new NextResponse("Office id is required", { status: 400 });
    }

 
    const office = await prismadb.offices.findUnique({
      where: {
        id: params.officeId,
      },
      include: {
        billboard: true,
      }
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



export async function PUT(req: Request, { params }: { params: { departmentId: string; officeId: string } }) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

  const body = await req.json();
  const bioIndexCode = (body.bioIndexCode ?? "").toString().trim().toUpperCase() || null;

  // (optional) validate alnum max 16
  if (bioIndexCode && !/^[A-Z0-9]{1,16}$/.test(bioIndexCode)) {
    return NextResponse.json({ error: "BIO Index Code must be letters/numbers only (max 16)." }, { status: 400 });
  }

  // make sure office belongs to dept & user
  const ok = await prismadb.offices.findFirst({
    where: { id: params.officeId, departmentId: params.departmentId, department: { userId } },
    select: { id: true },
  });
  if (!ok) return new NextResponse("Unauthorized", { status: 403 });

  const updated = await prismadb.offices.update({
    where: { id: params.officeId },
    data: { bioIndexCode },
    select: { id: true, name: true, bioIndexCode: true },
  });

  return NextResponse.json(updated);
}