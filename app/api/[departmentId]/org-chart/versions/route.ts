import {
  createOrgChartVersion,
  listOrgChartVersions,
} from "@/lib/org-chart-store";
import { OrgChartDocument } from "@/types/orgChart";
import { NextResponse } from "next/server";

type Params = {
  params: {
    departmentId: string;
  };
};

export async function GET(_request: Request, { params }: Params) {
  const versions = listOrgChartVersions(params.departmentId);
  return NextResponse.json(versions);
}

export async function POST(request: Request, { params }: Params) {
  try {
    const body = (await request.json()) as {
      label?: string;
      data?: OrgChartDocument;
    };

    if (!body.label || !body.label.trim()) {
      return new NextResponse("Label is required", { status: 400 });
    }

    if (!isValidDocument(body.data)) {
      return new NextResponse("Invalid org chart document", { status: 400 });
    }

    const version = createOrgChartVersion(
      params.departmentId,
      body.label.trim(),
      body.data
    );

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("[org-chart version create]", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to save version",
      { status: 500 }
    );
  }
}

function isValidDocument(document: unknown): document is OrgChartDocument {
  if (!document || typeof document !== "object") return false;
  const doc = document as OrgChartDocument;
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) return false;
  return true;
}
