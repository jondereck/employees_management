import { ToolsLayout } from "@/components/layouts/tools-layout";
import SGRangeTool from "./SGRangeTool";

export default function SGRangePage({
  params,
}: {
  params: { departmentId: string };
}) {
  return (
    <ToolsLayout
      params={params}
      title="SG Range Insights"
      description="Query counts and total salaries for SG ranges 1–33."
      breadcrumbs={[{ label: "Segment-Range Queries" }]}
      contentClassName="space-y-6"
    >
      <SGRangeTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
