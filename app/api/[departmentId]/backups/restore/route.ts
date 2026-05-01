export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { BackupHttpError, requireBackupAccess } from "@/lib/backups/access";
import { backupErrorResponse, noStoreJson, readBackupInput } from "@/lib/backups/http";
import { readLocalBackup, restoreDepartmentBackup } from "@/lib/backups/service";

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const access = await requireBackupAccess(params.departmentId);
    const input = await readBackupInput(req);

    if (input.confirmation !== "RESTORE") {
      throw new BackupHttpError(400, 'Type "RESTORE" to confirm.');
    }

    const buffer = input.buffer ?? (input.backupId ? await readLocalBackup(input.backupId) : null);
    if (!buffer) {
      throw new BackupHttpError(400, "Provide a backupId or upload a ZIP file.");
    }

    const result = await restoreDepartmentBackup({
      departmentId: params.departmentId,
      restoredBy: access.userId,
      buffer,
    });

    return noStoreJson({
      ok: true,
      ...result,
    });
  } catch (error) {
    return backupErrorResponse(error);
  }
}
