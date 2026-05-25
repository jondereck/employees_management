import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server"

function normalizeOptionalUrl(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return { error: "Invalid URL value" } as const;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return { error: "Invalid URL value" } as const;
  }
}

function hasUrlError(
  value: string | null | { error: string }
): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

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
    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const rawLogoUrl = body?.logoUrl;
    const rawSystemLogoUrl = body?.systemLogoUrl;

    if (!rawName) {
      return new NextResponse("Name is required", { status: 400 });
    }

    const normalizedLogoUrl = normalizeOptionalUrl(rawLogoUrl);
    if (hasUrlError(normalizedLogoUrl)) {
      return new NextResponse("Invalid logo URL", { status: 400 });
    }

    const normalizedSystemLogoUrl = normalizeOptionalUrl(rawSystemLogoUrl);
    if (hasUrlError(normalizedSystemLogoUrl)) {
      return new NextResponse("Invalid system logo URL", { status: 400 });
    }

    if (!params.departmentId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    const updateResult = await prismadb.department.updateMany({
      where: {
        id: params.departmentId,
        userId,
      },
      data: {
        name: rawName,
        logoUrl: normalizedLogoUrl,
        systemLogoUrl: normalizedSystemLogoUrl,
      } as any,
    });

    if (updateResult.count === 0) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const department = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      },
    });

    if (!department) {
      return new NextResponse("Department not found", { status: 404 });
    }

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
