"use client"

import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { CellAction } from "./cell-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { Eligibility } from "@prisma/client"
import { DataTableColumnHeader } from "@/components/ui/column-header"


// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type EligibilityColumn = {
  id: string
  eligibilityTypes: string
  customType: string
  value: string
  createdAt: string
}

export const columns: ColumnDef<EligibilityColumn>[] = [
  
  {
    accessorKey: "customType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Eligibility" />
    ),
  },

  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => (
      <div className="flex items-center  gap-2">
        {row.original.value}
        <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: row.original.value }}>
        </div>
      </div>
    )
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />  
    )
  },

  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />
  }

];


// Add the following code to display the selected row count
