import prismadb from "@/lib/prismadb";
import { format  } from "date-fns";
import { OfficesClient } from "./components/client";
import { OfficesColumn } from "./components/columns";

const OfficesPage = async ({
  params
}: { 
  params: { departmentId: string}
}) => {
  const offices = await prismadb.offices.findMany({
    where: {
      departmentId: params.departmentId
    },
    include: {
      billboard: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const formattedOffices: OfficesColumn[] = offices.map((item)=> ({
    id: item.id,
    name: item.name,
    billboardLabel: item.billboard.label,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return ( 
  <div className="flex-col">
    <div className="flex-1 space-y-4 p-8  pt-6">
    <OfficesClient data={formattedOffices}/>
    </div>
  </div> );
}
 
export default OfficesPage;