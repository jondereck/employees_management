"use client"

import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { CellAction } from "./cell-actions"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import { Checkbox } from "@/components/ui/checkbox"


// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type EmployeeTypeColumn = {
  id: string
  name: string
  value: string
  createdAt: string
}

export const columns: ColumnDef<EmployeeTypeColumn>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox 
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,

  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "value",
    header: "Color Legend",
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
    ),
  },
  {
      id: "actions",
      cell: ({ row }) => <CellAction data={row.original}/> 
  },
  

]
