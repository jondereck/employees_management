import prismadb from "@/lib/prismadb";
import { format  } from "date-fns";
import { BillboardsClient } from "./components/client";
import { BillboardColumn } from "./components/columns";

const BillboardsPage = async ({
  params
}: { 
  params: { departmetId: string}
}) => {
  const billboards = await prismadb.billboard.findMany({
    where: {
      departmentId: params.departmetId
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
    <div className="flex-1 space-y-4 p-8  pt-6">
    <BillboardsClient data={formattedBillboards}/>
    </div>
  </div> );
}
 
export default BillboardsPage;