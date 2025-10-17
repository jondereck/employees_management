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
      title="Biometrics Uploader"
      description="Upload the monthly “Employee Attendance Record” (.xlsx). We’ll compute Late & Undertime based on earliest-in & latest-out."
      breadcrumbs={[{ label: "Biometrics Uploader" }]}
      contentClassName="space-y-6"
    >
      <BioLogUploader />
    </ToolsLayout>
  );
}
