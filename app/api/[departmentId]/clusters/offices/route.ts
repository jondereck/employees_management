// app/api/[departmentId]/clusters/offices/route.ts
import { NextResponse } from "next/server";

import { attachEmployeeCounts, buildOfficeClusters, buildOfficeClustersDSU } from "@/lib/build-office-clusters";

export async function GET(req: Request, { params }: { params: { departmentId: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const algo = searchParams.get("algo") ?? "map"; // "map" | "dsu"
    const onlyMerged = searchParams.get("onlyMerged") === "true";
    const includeArchived = searchParams.get("includeArchived") === "true";
    const minSize = Number(searchParams.get("minSize") ?? (onlyMerged ? 2 : 1));

    const base =
      algo === "dsu"
        ? await buildOfficeClustersDSU(params.departmentId)
        : await buildOfficeClusters(params.departmentId);

    const enriched = await attachEmployeeCounts(base, { includeArchived });
    const filtered = enriched.filter(c => c.offices.length >= minSize);

    return NextResponse.json({
      ok: true,
      meta: {
        departmentId: params.departmentId,
        algo,
        totalClusters: enriched.length,
        shownClusters: filtered.length,
        minSize,
        includeArchived,
      },
      data: filtered,
    });
  } catch (err: any) {
    console.error("[OFFICE_CLUSTERS_GET]", err);
    return NextResponse.json({ ok: false, message: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
