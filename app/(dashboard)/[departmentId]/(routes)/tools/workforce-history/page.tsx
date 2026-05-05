import { ToolsLayout } from "@/components/layouts/tools-layout";

import WorkforceHistoryTool from "./WorkforceHistoryTool";

export default function WorkforceHistoryPage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="Workforce History"
      description="Build yearly employee status reports from historical workforce snapshots."
      breadcrumbs={[{ label: "Workforce History" }]}
      contentClassName="space-y-6"
    >
      <WorkforceHistoryTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
