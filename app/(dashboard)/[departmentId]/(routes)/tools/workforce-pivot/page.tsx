import { ToolsLayout } from "@/components/layouts/tools-layout";
import WorkforcePivotTool from "./WorkforcePivotTool";

export default function WorkforcePivotPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Workforce Pivot Table"
      description="Cross-tab employee type, eligibility, supervisory level, and gender, filtered by multi-select employee type and eligibility type."
      breadcrumbs={[{ label: "Workforce Pivot Table" }]}
      contentClassName="space-y-6"
    >
      <WorkforcePivotTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
