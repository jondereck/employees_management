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
      title="SG Range Analytics"
      description="Query counts and total salaries for SG ranges 1–33."
      breadcrumbs={[{ label: "SG Range Analytics" }]}
      contentClassName="space-y-6"
    >
      <SGRangeTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}
