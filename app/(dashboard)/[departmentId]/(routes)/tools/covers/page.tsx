import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { ToolsLayout } from "@/components/layouts/tools-layout";
import { ToolNavigationLink } from "@/components/tools/navigation-link";
import { BillboardsClient } from "./components/client";
import { BillboardColumn } from "./components/columns";
import prismadb from "@/lib/prismadb";

const CoversPage = async ({
  params,
}: {
  params: { departmentId: string };
}) => {
  const billboards = await prismadb.billboard.findMany({
    where: {
      departmentId: params.departmentId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedBillboards: BillboardColumn[] = billboards.map((item) => ({
    id: item.id,
    label: item.label,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return (
    <ToolsLayout
      params={params}
      title="Covers"
      description="Manage covers for your department."
      breadcrumbs={[{ label: "Covers" }]}
      actions={
        <Button asChild>
          <ToolNavigationLink href={`/${params.departmentId}/tools/covers/new`}>
            New Cover
          </ToolNavigationLink>
        </Button>
      }
      contentClassName="space-y-6"
    >
      <BillboardsClient data={formattedBillboards} />
    </ToolsLayout>
  );
};

export default CoversPage;
