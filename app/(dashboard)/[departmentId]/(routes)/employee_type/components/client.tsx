"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { EmployeeTypeColumn, columns } from "./columns";


import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import ApiList from "@/components/ui/api-list";


interface EmployeeTypeProps {
  data: EmployeeTypeColumn[];
}

export const  EmployeeTypeClient = ({
  data
}: EmployeeTypeProps) => {
  const router = useRouter();
  const params = useParams();


  return ( 
    <>
    <div className="flex items-center justify-between">
    <Heading
      title={`Employee Type (${data.length})`}
      description="Manage employee type for your offices"
    />
    <Button onClick={() => router.push(`/${params.departmentId}/employee_type/new`)}>
      <Plus className="mr-2 h-4 w-4"/>
     Add
    </Button>
    </div>
    <Separator/>
    <DataTable searchKey="name" columns={columns} data={data}/>
    <Heading
    title="API"
    description="API calls for employeeType"
    />
    <ApiList entityIdName="employeeTypeId" entityName="employee_type"/>
    </>
   );
}
