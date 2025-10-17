import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import BioLogUploader from "./BioLogUploader";

export default function BiometricsToolPage({
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
          { label: "Biometrics Uploader" }
        ]}
      />
      <div>
        <h1 className="mb-4 text-2xl font-semibold">Biometrics Uploader</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Upload the monthly “Employee Attendance Record” (.xlsx). We’ll compute Late &amp; Undertime based on earliest-in &amp; latest-out.
        </p>
        <BioLogUploader />
      </div>
    </div>
  );
}
