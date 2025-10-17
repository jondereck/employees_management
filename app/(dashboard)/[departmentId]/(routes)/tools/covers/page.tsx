import { format } from "date-fns";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToolsPageShell } from "@/app/tools/layout";
import prismadb from "@/lib/prismadb";
import { BillboardsClient } from "./components/client";
import { BillboardColumn } from "./components/columns";

const CoversPage = async ({
  params
}: {
  params: { departmentId: string }
}) => {
  const billboards = await prismadb.billboard.findMany({
    where: {
      departmentId: params.departmentId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const formattedBillboards: BillboardColumn[] = billboards.map((item)=> ({
    id: item.id,
    label: item.label,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return (
    <ToolsPageShell
      heading="Covers"
      description="Manage lobby covers and office assignments."
      breadcrumbs={[
        { label: "Tools", href: `/${params.departmentId}/tools` },
        { label: "Covers" },
      ]}
      fullWidth
      actions={(
        <Button asChild>
          <Link href={`/${params.departmentId}/tools/covers/new`}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New cover
          </Link>
        </Button>
      )}
    >
      <BillboardsClient data={formattedBillboards} />
    </ToolsPageShell>
  );
}

export default CoversPage;