import CsvAttendanceImport from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/csv-attendance-import";
import { ToolsPageShell } from "@/app/tools/layout";

export default function AttendanceImportPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  return (
    <ToolsPageShell
      heading="CSV Attendance Import"
      description="Upload attendance CSV exports and convert them into clean employee summaries."
      breadcrumbs={[
        { label: "Tools", href: `/${departmentId}/tools` },
        { label: "CSV Attendance Import" },
      ]}
    >
      <div className="max-w-4xl space-y-4">
        <CsvAttendanceImport />
      </div>
    </ToolsPageShell>
  );
}
