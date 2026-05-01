import { ToolsLayout } from "@/components/layouts/tools-layout";

import BackupRestoreClient from "./BackupRestoreClient";

export default function BackupRestoreToolPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Backup & Restore"
      description="Create department snapshots, download portable ZIP backups, and restore this department from a validated backup."
      breadcrumbs={[{ label: "Backup & Restore" }]}
      contentClassName="space-y-6"
    >
      <BackupRestoreClient departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
