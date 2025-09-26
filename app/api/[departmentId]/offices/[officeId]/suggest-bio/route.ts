// app/api/[departmentId]/offices/[officeId]/suggest-bio/route.ts
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

import { OFFICE_INDEX_CODE_BY_ID } from "@/lib/bio-index-map";
import { derivePrefixAndWidth, padSuffix, firstFreeSuffix, splitEmployeeNo } from "@/lib/bio-utils";

export async function GET(_req: Request, { params }: { params: { departmentId: string; officeId: string } }) {
  try {
    const office = await prismadb.offices.findUnique({
      where: { id: params.officeId },
      select: { id: true, name: true },
    });
    if (!office) return new NextResponse("Office not found", { status: 404 });

  const indexBaseStr = OFFICE_INDEX_CODE_BY_ID[office.id];
if (!indexBaseStr) {
  return new NextResponse(`No index base configured for ${office.name} (id=${office.id}).`, { status: 400 });
}
const { prefix, width } = derivePrefixAndWidth(indexBaseStr);

// ✅ collect ALL officeIds that share this index code (e.g., RHU I/II/III)
const groupOfficeIds = Object.entries(OFFICE_INDEX_CODE_BY_ID)
  .filter(([, code]) => code === indexBaseStr)
  .map(([id]) => id);

// 1) fetch employees for ALL offices sharing the same index code
const emps = await prismadb.employee.findMany({
  where: { officeId: { in: groupOfficeIds } },
  select: { employeeNo: true },
});

  // 2) parse used suffixes across the group
const usedSuffixes = new Set<number>();
for (const e of emps) {
  const { bio } = splitEmployeeNo(e.employeeNo);
  if (!bio || !/^\d+$/.test(bio) || !bio.startsWith(prefix)) continue;
  const suffixStr = bio.slice(prefix.length);
  if (width > 0 && suffixStr.length !== width) continue;
  const n = Number(suffixStr || "0");
  if (Number.isFinite(n) && n > 0) usedSuffixes.add(n);
}

// 3) suggest first free from the union
const free = firstFreeSuffix(usedSuffixes, width);
const suggestion = width > 0 ? `${prefix}${padSuffix(free, width)}` : String(Number(indexBaseStr) + free);

return NextResponse.json({
  officeId: office.id,
  officeName: office.name,
  indexBase: indexBaseStr,
  sharedOfficeIds: groupOfficeIds, // debug/info
  suggestion,
  takenCount: usedSuffixes.size,
});
  } catch (err: any) {
    return new NextResponse(err?.message ?? "Failed to suggest bio", { status: 500 });
  }
}
