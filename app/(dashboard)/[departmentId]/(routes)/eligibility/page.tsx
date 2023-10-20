import prismadb from "@/lib/prismadb";
import { format  } from "date-fns";
import { EligibilityClient } from "./components/client";
import { EligibilityColumn } from "./components/columns";


const EligibiltyPage = async ({
  params
}: { 
  params: { departmentId: string}
}) => {
  const eligibility = await prismadb.eligibility.findMany({
    where: {
      departmentId: params.departmentId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const formattedEligibilty: EligibilityColumn[] = eligibility.map((item)=> ({
    id: item.id,
    eligibilityTypes: item.eligibilityTypes,
    customType: item.customType,
    value: item.value, 
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return ( 
  <div className="flex-col">
    <div className="flex-1 space-y-4 p-8  pt-6">
    <EligibilityClient data={formattedEligibilty}/>
    </div>
  </div> );
}
 
export default EligibiltyPage;