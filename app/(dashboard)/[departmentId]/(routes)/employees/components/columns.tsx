"use client"

import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { CellAction } from "./cell-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import PreviewModal from "../../(frontend)/view/components/preview"
import { Eye } from "./eye"
import { Eligibility, EmployeeType, Image, Offices } from "../../(frontend)/view/types"



// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type EmployeesColumn = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  gender: string;
  contactNumber: string;
  position: string;
  birthday: string;
  gsisNo: string;
  tinNo: string;
  philHealthNo: string;
  pagibigNo: string;
  salary: string; // You may need to adjust the type if salary is not a number
  dateHired: string;
  isFeatured: boolean;
  isArchived: boolean;
  createdAt: string;
  images: Image[];
  offices: string;
  isHead: boolean;
  eligibility: string;
  employeeType: string;
}

export const columns: ColumnDef<EmployeesColumn>[] = [
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
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />
  },
  // {
  //   id: "eye",
  //   cell: ({ row }) => <Eye data={row.original} />
  // },
  {
    accessorKey: "lastName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Name" />
    ),
  },
  {
    accessorKey: "firstName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="First Name" />
    ),
  }, {
    accessorKey: "middleName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Middle Name" />
    ),
  }, {
    accessorKey: "suffix",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Suffix" />
    ),
  },
  {
    accessorKey: "gender",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gender" />
    ),
  },
  {
    accessorKey: "contactNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact Number" />
    ),
  },
  {
    accessorKey: "position",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Position" />
    ),
  },
  {
    accessorKey: "birthday",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Birthday" />
    ),
  },
  {
    accessorKey: "tinNo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TIN No." />
    ),
  },
  {
    accessorKey: "gsisNo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="GSIS No." />
    ),
  },
  {
    accessorKey: "philHealthNo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Philhealth No." />
    ),
  },
  {
    accessorKey: "pagibigNo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pagibig No." />
    ),
  },
  {
    accessorKey: "salary",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Salary" />
    ),
  },
  {
    accessorKey: "dateHired",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date Hired" />
    ),
  },
  {
    accessorKey: "isFeatured",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Featured" />
    ),
  },
  {
    accessorKey: "isArchived",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title=" Archived" />
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title=" Created at" />
    ),
  },


]
