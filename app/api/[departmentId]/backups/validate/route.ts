export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { BackupHttpError, requireBackupAccess } from "@/lib/backups/access";
import { backupErrorResponse, noStoreJson, readBackupInput } from "@/lib/backups/http";
import { readLocalBackup, validateDepartmentBackupBuffer } from "@/lib/backups/service";

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    await requireBackupAccess(params.departmentId);
    const input = await readBackupInput(req);
    const buffer = input.buffer ?? (input.backupId ? await readLocalBackup(input.backupId) : null);

    if (!buffer) {
      throw new BackupHttpError(400, "Provide a backupId or upload a ZIP file.");
    }

    const parsed = await validateDepartmentBackupBuffer(buffer, params.departmentId);

    return noStoreJson({
      ok: true,
      manifest: parsed.manifest,
      counts: parsed.manifest.counts,
    });
  } catch (error) {
    return backupErrorResponse(error);
  }
}
