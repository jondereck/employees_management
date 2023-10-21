
import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { CellAction } from "./cell-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import prismadb from "@/lib/prismadb"
import { Badge } from "@/components/ui/badge"


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
        // cell: async ({ row }) => {
        //   const name = await prismadb.offices.findUnique({
        //     where: { id: row.original.id },
        //   });
  
        // },
  },
  {
    accessorKey: "billboard",
    header: "Billboard",
    cell: ({ row }) => row.original.billboardLabel,
  
  },

  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
  },
  {
      id: "actions",
      cell: ({ row }) => <CellAction data={row.original}/> 
  }

]
