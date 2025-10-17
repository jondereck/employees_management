import { ToolsLayout } from "@/components/layouts/tools-layout";
import CsvAttendanceImport from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/csv-attendance-import";

export default function AttendanceImportPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="CSV Attendance Import"
      description="Upload attendance CSV exports and convert them into clean employee summaries."
      breadcrumbs={[{ label: "CSV Attendance Import" }]}
      contentClassName="max-w-4xl space-y-4"
    >
      <CsvAttendanceImport />
    </ToolsLayout>
  );
}
