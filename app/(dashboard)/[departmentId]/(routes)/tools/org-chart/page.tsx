import { ToolsLayout } from "@/components/layouts/tools-layout";
import prismadb from "@/lib/prismadb";
import dynamic from "next/dynamic";

const OrgChartTool = dynamic(
  () => import("@/components/tools/org-chart/OrgChartTool"),
  { ssr: false }
);

type PageProps = {
  params: { departmentId: string };
};

export default async function OrgChartPage({ params }: PageProps) {
  const department = await prismadb.department.findFirst({
    where: { id: params.departmentId },
    select: { logoUrl: true },
  });

  return (
    <ToolsLayout
      params={params}
      title="Org Chart Builder"
      description="Edit and export per-office org charts."
      breadcrumbs={[{ label: "Org Chart Builder" }]}
      compact
      contentClassName="min-h-0 flex-1"
    >
      <OrgChartTool
        departmentId={params.departmentId}
        logoUrl={department?.logoUrl ?? null}
      />
    </ToolsLayout>
  );
}
