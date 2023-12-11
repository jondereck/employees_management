"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { OfficesColumn, columns } from "./columns";


import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import ApiList from "@/components/ui/api-list";
import ApiHeading from "@/components/ui/api-heading";


interface OfficesClientProps {
  data: OfficesColumn[];
}

export const  OfficesClient = ({
  data
}: OfficesClientProps) => {
  const router = useRouter();
  const params = useParams();


  return ( 
    <>
    <div className="flex items-center justify-between">
    <Heading
      title={`Offices (${data.length})`}
      description="Manage offices on your work workplace."
    />
    <Button onClick={() => router.push(`/${params.departmentId}/offices/new`)}>
      <Plus className="mr-2 h-4 w-4"/>
      Add new
    </Button>
    </div>
    <Separator/>
    <DataTable searchKey="name" columns={columns} data={data}/>
    <ApiHeading
    title="API"
    description="API calls for Offices"
    />
    <ApiList entityIdName="officeId" entityName="offices"/>
    </>
   );
}
