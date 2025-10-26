import { getOrgChartVersion } from "@/lib/org-chart-store";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
    versionId: string;
  };
};

export async function GET(_request: Request, { params }: Params) {
  const version = getOrgChartVersion(params.departmentId, params.versionId);
  if (!version) {
    return new NextResponse("Version not found", { status: 404 });
  }
  return NextResponse.json(version);
}

