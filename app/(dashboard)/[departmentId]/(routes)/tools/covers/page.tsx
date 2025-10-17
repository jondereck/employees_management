import prismadb from "@/lib/prismadb";
import { format } from "date-fns";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
    <div className="flex-col">
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <Breadcrumbs
          items={[
            { label: "Tools", href: `/${params.departmentId}/tools` },
            { label: "Covers" }
          ]}
        />
        <BillboardsClient data={formattedBillboards} />
      </div>
    </div>
  );
}

export default CoversPage;