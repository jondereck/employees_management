
import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { CellAction } from "./cell-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import { Badge } from "@/components/ui/badge"


// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type OfficesColumn = {
  id: string
  name: string,
  billboardLabel: string,
    bioIndexCode: string | null;
  createdAt: string
}


export const columns: ColumnDef<OfficesColumn>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: "billboardLabel",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Billboard" />,
    cell: ({ row }) => row.original.billboardLabel ?? "—",
  },

  // ✅ NEW: bioIndexCode column
  {
    accessorKey: "bioIndexCode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Bio Index Code" />,
    cell: ({ row }) => {
      const code = row.original.bioIndexCode;
      return code ? (
        <Badge variant="secondary" className="font-mono tracking-tight">
          {code}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
    sortingFn: "alphanumeric",
    enableSorting: true,
  },

  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];