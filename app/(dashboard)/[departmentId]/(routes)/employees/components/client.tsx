"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { EmployeesColumn, columns } from "./columns";


import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import ApiList from "@/components/ui/api-list";
import ApiHeading from "@/components/ui/api-heading";


interface EmployeesClientProps {
  data: EmployeesColumn[];
}

export const  EmployeesClient = ({
  data
}: EmployeesClientProps) => {
  const router = useRouter();
  const params = useParams();


  return ( 
    <>
    <div className="flex items-center justify-between">
    <Heading
      title={`Employees (${data.length})`}
      description="Manage employees for your Offices"
    />
    <Button onClick={() => router.push(`/${params.departmentId}/employees/new`)}>
      <Plus className="mr-2 h-4 w-4"/>
      Add
    </Button>
    </div>
    <Separator/>
    <DataTable  searchKeys={['firstName','lastName']} columns={columns} data={data}/>
    <ApiHeading
    title="API"
    description="API calls for employees"
    />
    <ApiList entityIdName="employeesId" entityName="employees"/>
    </>
   );
}
