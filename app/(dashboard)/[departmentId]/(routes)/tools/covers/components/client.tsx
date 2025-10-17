"use client";

import { BillboardColumn, columns } from "./columns";

import { DataTable } from "@/components/ui/data-table";
import ApiList from "@/components/ui/api-list";
import ApiHeading from "@/components/ui/api-heading";


interface BillboardFormProps {
  data: BillboardColumn[];
}

export const BillboardsClient = ({ data }: BillboardFormProps) => {
  return (
    <div className="space-y-6">
      <DataTable searchKeys={["label"]} columns={columns} data={data} />
      <div className="space-y-4">
        <ApiHeading title="API" description="API calls for covers" />
        <ApiList entityIdName="billboardsId" entityName="billboards" />
      </div>
    </div>
  );
};
