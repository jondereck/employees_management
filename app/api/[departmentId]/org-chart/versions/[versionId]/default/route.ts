import { setDefaultOrgChartVersion } from "@/lib/org-chart-store";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
    versionId: string;
  };
};

export async function POST(_request: Request, { params }: Params) {
  const version = setDefaultOrgChartVersion(
    params.departmentId,
    params.versionId
  );
  if (!version) {
    return new NextResponse("Version not found", { status: 404 });
  }
  return NextResponse.json(version);
}

