import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import CsvAttendanceImport from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/csv-attendance-import";

export default function AttendanceImportPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: "Tools", href: `/${departmentId}/tools` },
          { label: "CSV Attendance Import" },
        ]}
      />
      <div className="max-w-4xl space-y-4">
        <h1 className="text-2xl font-semibold">CSV Attendance Import</h1>
        <p className="text-sm text-muted-foreground">
          Upload attendance CSV exports and convert them into clean employee summaries.
        </p>
        <CsvAttendanceImport />
      </div>
    </div>
  );
}
