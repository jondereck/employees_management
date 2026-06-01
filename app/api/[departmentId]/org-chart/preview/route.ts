import { buildInitialOrgDocument } from "@/lib/org-chart";
import { requireOrgChartDepartmentAccess } from "@/lib/org-chart-access";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireOrgChartDepartmentAccess(params.departmentId);
    if (access.error) return access.error;
    const body = await request.json().catch(() => ({}));
    const includeStaffUnit = Boolean(body?.includeStaffUnit ?? false);
    const document = await buildInitialOrgDocument(params.departmentId, {
      includeStaffUnit,
    });
    return NextResponse.json({ document });
  } catch (error) {
    console.error("[org-chart preview]", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to build preview",
      { status: 500 }
    );
  }
}
