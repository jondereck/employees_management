export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { requireBackupAccess } from "@/lib/backups/access";
import { backupErrorResponse } from "@/lib/backups/http";
import { readLocalBackup, validateDepartmentBackupBuffer } from "@/lib/backups/service";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string; backupId: string } }
) {
  try {
    await requireBackupAccess(params.departmentId);
    const buffer = await readLocalBackup(params.backupId);
    await validateDepartmentBackupBuffer(buffer, params.departmentId);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${params.backupId}.zip"`,
      },
    });
  } catch (error) {
    return backupErrorResponse(error);
  }
}
