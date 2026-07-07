import { ToolsLayout } from "@/components/layouts/tools-layout";
import TrainingTool from "./TrainingTool";

export default function TrainingPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Learning & Development"
      description="Import training records, link them to employees by BIO number, and generate the Annex 6-G registry and 6-H dashboard."
      breadcrumbs={[{ label: "Learning & Development" }]}
      contentClassName="space-y-6"
    >
      <TrainingTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
