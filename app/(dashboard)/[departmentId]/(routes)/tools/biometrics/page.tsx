import { ToolsLayout } from "@/components/layouts/tools-layout";
import BioLogUploader from "./BioLogUploader";

export default function BiometricsToolPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Timekeeping Analyzer"
      description="Upload the monthly “Employee Attendance Record” (.xlsx). We’ll compute Late & Undertime, Overtime hours, and generate a clean report for your review."
      breadcrumbs={[{ label: "Timekeeping Analyzer" }]}
      contentClassName="space-y-6"
    >
      <BioLogUploader />
    </ToolsLayout>
  );
}
