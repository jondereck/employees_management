"use client"

import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { CellAction } from "./cell-actions"



// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type OfficesColumn = {
  id: string
  name: string,
  billboardLabel: string,
  createdAt: string
}

export const columns: ColumnDef<OfficesColumn>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "desc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "billboard",
    header: "Billboard",
    cell: ({ row }) => row.original.billboardLabel,
  
  },

  {
    accessorKey: 'createdAt',
    header:"Date"
  },
  {
      id: "actions",
      cell: ({ row }) => <CellAction data={row.original}/> 
  }

]
