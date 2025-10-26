import { ToolsLayout } from "@/components/layouts/tools-layout";
import dynamic from "next/dynamic";

const OrgChartTool = dynamic(
  () => import("@/components/tools/org-chart/OrgChartTool"),
  { ssr: false }
);

type PageProps = {
  params: { departmentId: string };
};

export default function OrgChartPage({ params }: PageProps) {
  return (
    <ToolsLayout
      params={params}
      title="Org Chart Builder"
      description="Edit and export per-office org charts."
      breadcrumbs={[{ label: "Org Chart Builder" }]}
      contentClassName="space-y-6"
    >
      <OrgChartTool departmentId={params.departmentId} />
    </ToolsLayout>
  );
}

