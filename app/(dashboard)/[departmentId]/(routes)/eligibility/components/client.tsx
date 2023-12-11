"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { EligibilityColumn, columns } from "./columns";


import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import ApiList from "@/components/ui/api-list";
import ApiHeading from "@/components/ui/api-heading";


interface EligibilityProps {
  data: EligibilityColumn[];
}

export const  EligibilityClient = ({
  data
}: EligibilityProps) => {
  const router = useRouter();
  const params = useParams();


  return ( 
    <>
    <div className="flex items-center justify-between">
    <Heading
      title={`Eligibility Type (${data.length})`}
      description="Manage eligibility type for your employees"
    />
    <Button onClick={() => router.push(`/${params.departmentId}/eligibility/new`)}>
      <Plus className="mr-2 h-4 w-4"/>
      New
    </Button>
    </div>
    <Separator/>
    <DataTable searchKey="name" columns={columns} data={data}/>
    <ApiHeading
    title="API"
    description="API calls for employeeType"
    />
    <ApiList entityIdName="eligibilityId" entityName="eligibility"/>
    
    </>
   );
}
