"use client";

import { DataTable } from "@/components/ui/data-table";
import ApiHeading from "@/components/ui/api-heading";
import ApiList from "@/components/ui/api-list";
import { Separator } from "@/components/ui/separator";

import { BillboardColumn, columns } from "./columns";

interface BillboardsClientProps {
  data: BillboardColumn[];
}

export const BillboardsClient = ({ data }: BillboardsClientProps) => {
  return (
    <div className="space-y-6">
      <DataTable searchKeys={["label"]} columns={columns} data={data} />
      <div className="space-y-4">
        <Separator />
        <ApiHeading title="API" description="API calls for covers" />
        <ApiList entityIdName="billboardsId" entityName="billboards" />
      </div>
    </div>
  );
};
