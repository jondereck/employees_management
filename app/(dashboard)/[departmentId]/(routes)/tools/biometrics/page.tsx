import BioLogUploader from "./BioLogUploader";
import { ToolsPageShell } from "@/app/tools/layout";

export default function BiometricsToolPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  return (
    <ToolsPageShell
      heading="Biometrics Uploader"
      description={`Upload the monthly "Employee Attendance Record" (.xlsx). We'll compute Late & Undertime based on earliest-in & latest-out.`}
      breadcrumbs={[
        { label: "Tools", href: `/${departmentId}/tools` },
        { label: "Biometrics Uploader" },
      ]}
      fullWidth
    >
      <BioLogUploader />
    </ToolsPageShell>
  );
}
