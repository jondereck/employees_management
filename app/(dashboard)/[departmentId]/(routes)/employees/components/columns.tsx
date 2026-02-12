"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useState } from "react"
import toast from "react-hot-toast"
import moment from 'moment'
import { ArrowUpDown, Copy, MoreHorizontal, User, Briefcase, Calendar } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ActionTooltip } from "@/components/ui/action-tooltip"
import { DataTableColumnHeader } from "@/components/ui/column-header"

import { CellAction } from "./cell-actions"
import { Eye } from "./eye"
import AgeCell from "./age-cell"
import YearsOfService from "./years_of_service_cell"

import { cn } from "@/lib/utils"
import { salarySchedule } from "@/utils/salarySchedule"
import { computeStep } from "@/utils/compute-step"
import { 
  formatContactNumber, 
  formatDate, 
  formatFullName, 
  formatGsisNumber, 
  formatPagIbigNumber, 
  formatPhilHealthNumber, 
  formatSalary, 
  getBirthday 
} from "@/utils/utils"

// --- Types ---
export interface Offices { id: string; name: string; }
export interface Image { id: string; url: string; value: string; }
export interface Eligibility { id: string; name: string; value: string; }
export interface EmployeeType { id: string; name: string; value: string; }

export type EmployeesColumn = {
  id: string;
  department: string;
  employeeNo: string;
  offices: Offices;
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  gender: string;
  contactNumber: string;
  position: string;
  birthday: string;
  education: string;
  gsisNo: string;
  tinNo: string;
  philHealthNo: string;
  pagIbigNo: string;
  salary: string;
  salaryMode: string;
  dateHired: string;
  latestAppointment: string;
  terminateDate: string;
  isFeatured: boolean;
  isHead: boolean;
  isArchived: boolean;
  eligibility: Eligibility;
  employeeType: EmployeeType;
  images: Image[];
  region: string;
  province: string;
  city: string;
  barangay: string;
  houseNo: string;
  salaryGrade: string;
  salaryStep: string;
  memberPolicyNo: string;
  age: string;
  nickname: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  employeeLink: string;
  designation: { id: string; name: string } | null;
  note: string;
  publicId: string;
  publicVersion: number;
  publicEnabled: boolean;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  legacyQrAllowed: boolean;
}

const onCopy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
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
    id: "eye",
    header: "View",
    cell: ({ row }) => <Eye data={row.original} />
  },
  {
    accessorKey: "employeeNo",
    header: ({ column }) => <DataTableColumnHeader column={column} title="ID No." />,
    cell: ({ row }) => (
      <span className="font-mono font-medium text-slate-500 text-xs">
        {row.getValue("employeeNo") || "N/A"}
      </span>
    )
  },
  {
    accessorKey: "firstName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
    cell: ({ row }) => {
      const { firstName, middleName, lastName, suffix, gender, prefix, position, employeeType } = row.original;
      const fullName = formatFullName(firstName, middleName, lastName, suffix, gender, prefix, position);
      
      return (
        <ActionTooltip label="Click to copy full name" side="right">
          <div
            className="flex flex-col cursor-pointer group max-w-[200px]"
            onClick={() => onCopy(employeeType?.name === 'Job Order' ? `${fullName} (JO)` : fullName)}
          >
            <span className="font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
              {lastName}, {firstName} {suffix}
            </span>
            <span className="text-[10px] text-muted-foreground truncate italic">
              {middleName || "No middle name"}
            </span>
          </div>
        </ActionTooltip>
      );
    },
  },
  {
    accessorKey: "position",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
    cell: ({ row }) => (
      <div className="flex flex-col min-w-[140px]">
        <span className="text-sm font-medium leading-none mb-1">{row.original.position}</span>
        {row.original.designation && (
          <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded w-fit">
            {row.original.designation.name}
          </span>
        )}
      </div>
    )
  },
  {
    accessorKey: "officeName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    accessorFn: row => row.offices?.name ?? "",
    cell: ({ row }) => (
      <span className="text-xs font-semibold text-slate-600">
        {row.original.offices?.name ?? "N/A"}
      </span>
    ),
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue || filterValue === "all") return true;
      return row.getValue(columnId) === filterValue;
    },
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => {
      const gender = row.getValue("gender") as string;
      return (
        <Badge variant="secondary" className={cn(
          "font-normal capitalize shadow-sm",
          gender.toLowerCase() === "male" 
            ? "bg-blue-50 text-blue-700 border-blue-100" 
            : "bg-pink-50 text-pink-700 border-pink-100"
        )}>
          {gender}
        </Badge>
      );
    }
  },
  {
    accessorKey: "salary",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Salary" />,
    cell: ({ row }) => {
      const saved = Number(row.original.salary ?? 0);
      let amount = saved;

      if (saved <= 0) {
        const grade = Number(row.original.salaryGrade);
        const step = computeStep({
          dateHired: row.original.dateHired,
          latestAppointment: row.original.latestAppointment,
        });
        const rec = salarySchedule.find((s) => s.grade === grade);
        amount = rec ? rec.steps[step - 1] ?? 0 : 0;
      }
      
      return (
        <div className="flex flex-col">
          <span className="font-bold text-emerald-700">{formatSalary(String(amount))}</span>
          <span className="text-[10px] text-muted-foreground">S.G. {row.original.salaryGrade || "N/A"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "isArchived",
    header: "Status",
    cell: ({ row }) => {
      const isArchived = row.original.isArchived;
      return (
        <Badge className={cn(
          "rounded-full px-2.5 py-0.5 border-none",
          isArchived ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
        )}>
          <span className={cn(
            "h-1.5 w-1.5 rounded-full mr-1.5",
            isArchived ? "bg-slate-400" : "bg-emerald-500"
          )} />
          {isArchived ? "Inactive" : "Active"}
        </Badge>
      );
    },
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue || filterValue === "all") return true;
      const status = row.getValue(columnId) ? "Inactive" : "Active";
      return status === filterValue;
    },
  },
  {
    accessorKey: "contactNumber",
    header: "Contact",
    cell: ({ row }) => {
      const contact = row.getValue('contactNumber') as string;
      const formatted = formatContactNumber(contact);
      return (
        <button 
          onClick={() => onCopy(formatted)}
          className="text-xs hover:underline text-slate-600 font-medium"
        >
          {formatted}
        </button>
      );
    }
  },
  {
    id: "yearsOfService",
    header: "Tenure",
    cell: ({ row }) => (
      <div className="flex flex-col text-[11px]">
        <YearsOfService year_service={row.original.dateHired} />
        <span className="text-muted-foreground mt-0.5">since {formatDate(row.original.dateHired)}</span>
      </div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <CellAction data={row.original} />
  },
]