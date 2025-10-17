"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { BillboardColumn, columns } from "./columns";


import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import ApiList from "@/components/ui/api-list";
import ApiHeading from "@/components/ui/api-heading";


interface BillboardFormProps {
  data: BillboardColumn[];
}

export const  BillboardsClient = ({
  data
}: BillboardFormProps) => {
  const router = useRouter();
  const params = useParams();


  return ( 
    <>
    <div className="flex items-center justify-between">
    <Heading
      title={`Covers (${data.length})`}
      description="Manage covers for your departments"
    />
    <Button onClick={() => router.push(`/${params.departmentId}/tools/covers/new`)}>
      <Plus className="mr-2 h-4 w-4"/>
      New
    </Button>
    </div>
    <Separator/>
    <DataTable searchKeys={['label']} columns={columns} data={data}/>
    <ApiHeading
    title="API"
    description="API calls for covers"
    />
    <ApiList entityIdName="billboardsId" entityName="billboards"/>
    </>
   );
}
