export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireBackupAccess } from "@/lib/backups/access";
import { backupErrorResponse, noStoreJson } from "@/lib/backups/http";
import { createDepartmentBackup, listDepartmentBackups } from "@/lib/backups/service";
import { getLocalBackupDirectory } from "@/lib/backups/storage";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    await requireBackupAccess(params.departmentId);
    const backups = await listDepartmentBackups(params.departmentId);

    return noStoreJson({
      backups,
      storage: {
        type: "local",
        directory: getLocalBackupDirectory(),
      },
    });
  } catch (error) {
    return backupErrorResponse(error);
  }
}

export async function POST(
  _req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireBackupAccess(params.departmentId);
    const result = await createDepartmentBackup({
      departmentId: params.departmentId,
      createdBy: access.userId,
      reason: "manual",
    });

    return noStoreJson(result, { status: 201 });
  } catch (error) {
    return backupErrorResponse(error);
  }
}
