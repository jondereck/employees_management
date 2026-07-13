import { ToolsLayout } from "@/components/layouts/tools-layout";

import AttendanceExceptionsTool from "./AttendanceExceptionsTool";

export default function AttendanceExceptionsPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Attendance Exception Registry"
      description="Annex 8-C — import Tardiness and Undertime from biometrics PerDay, add MD/FD/UA/AWOL manually, and export the registry."
      breadcrumbs={[{ label: "Attendance Exception Registry" }]}
      contentClassName="space-y-6"
    >
      <AttendanceExceptionsTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
