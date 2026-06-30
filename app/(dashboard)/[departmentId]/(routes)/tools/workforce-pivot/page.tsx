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
      description="Switch between a flexible workforce matrix pivot and a fixed CSC-style workforce report with drilldown."
      breadcrumbs={[{ label: "Workforce Pivot Table" }]}
      contentClassName="space-y-6"
    >
      <WorkforcePivotTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
