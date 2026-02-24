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
      title="Event Attendance Import"
      description="Import QR-based attendance records for events and ceremonies. Upload the CSV export from your QR check-in system, and we’ll match it against employee records to generate clean attendance lists and reports."
      breadcrumbs={[{ label: "Event Attendance Import" }]}
      contentClassName="space-y-6"
    >
      <CsvAttendanceImport />
    </ToolsLayout>
  );
}
