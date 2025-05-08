

import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown, Copy } from "lucide-react"
import { CellAction } from "./cell-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import PreviewModal from "../../(frontend)/view/components/preview"
import { Eye } from "./eye"

import { useState } from "react"
import toast from "react-hot-toast"
import { ActionTooltip } from "@/components/ui/action-tooltip"
import getEmployees from "../../(frontend)/view/actions/get-employees"

import { Employees } from "../../(frontend)/view/types";
import AgeCell from "./age-cell"
import YearsOfService from "./years_of_service_cell"
import moment from 'moment';
import { format, isValid } from "date-fns"
import { formatContactNumber, formatDate, formatFullName, formatGsisNumber, formatPagIbigNumber, formatPhilHealthNumber, formatSalary, getBirthday } from "@/utils/utils"





// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export interface Offices {
  id: string;
  name: string;
}

export interface Image {
  id: string;
  url: string;
  value: string;
}

export interface Eligibility {
  id: string;
  name: string;
  value: string;
}

export interface EmployeeType {
  id: string;
  name: string;
  value: string;
}

export type EmployeesColumn = {
  id: string;
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
  dateHired: string;
  latestAppointment: string;
  terminateDate: string;
  isFeatured: boolean;
  isHead: boolean;
  isArchived: boolean;
  eligibility: Eligibility;
  employeeType: EmployeeType;
  images: Image[]; // Array of Image
  region: string;
  province: string;
  city: string;
  barangay: string;
  houseNo: string;
  salaryGrade: string;
  memberPolicyNo: string;
  age: string;
  nickname: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  employeeLink: string;
}


const onCopy = (text: string) => {
  navigator.clipboard.writeText(text);
}


// Function to remove ordinal indicators from the date string
const removeOrdinal = (dateString: string): string => {
  return dateString.replace(/(\d+)(th|st|nd|rd)/, '$1');
};

const dateFormats = [
  'MMMM D, YYYY', // e.g., March 28, 2000
];


const parseDate = (dateString: string) => {
  const cleanedDateString = removeOrdinal(dateString);
  for (const format of dateFormats) {
    const date = moment(cleanedDateString, format, true);
    if (date.isValid()) {
      return date;
    }
  }
  return null;
};


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
  {
    id: "eye",
    cell: ({ row }) => <Eye data={row.original} />
  },

  {
    accessorKey: "employeeNo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column}
        title="EmpNo." />
    ),
    cell: ({ row }) => row.getValue("employeeNo") || "N/A"
  },
  {
    accessorKey: "firstName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="FirstName" />
    ),
    cell: ({ row }) => {
      const firstName = row.original.firstName;
      const middleName = row.original.middleName || '';
      const lastName = row.original.lastName || '';
      const suffix = row.original.suffix || '';
      const gender = row.original.gender || '';
      const prefix = row.original.prefix || '';
      const position = row.original.position || '';

      const fullName = formatFullName(firstName, middleName, lastName, suffix,
        gender, prefix, position);

      const handleCopyClick = () => {
        let copiedText = fullName;
        if (row.original.employeeType && row.original.employeeType.name === 'Job Order') {
          copiedText += ' (Job Order)';
        }
        onCopy(copiedText);
        toast.success("Copied");
      };
      return (
        <ActionTooltip label="Copy" side="right">
          <div
            className={`flex border p-1 rounded-md items-center bg-gray-50 cursor-pointer justify-center `}
            onClick={handleCopyClick}
          >
            <span>{`${firstName} `}</span>
          </div>
        </ActionTooltip>
      );
    },
  },
  {
    accessorKey: "middleName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column}
        title="MiddleName" />
    ),
    cell: ({ row }) => row.getValue("middleName") || "N/A"
  },
  {
    accessorKey: "lastName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="LastName" />
    ),
  },

  {
    accessorKey: "suffix",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Suffix" />
    ),
    cell: ({ row }) => row.getValue("suffix") || "N/A"

  },

  {
    accessorKey: "nickname",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nickname" />
    ),
    cell: ({ row }) => row.getValue("nickname") || "N/A"
  },

  {
    accessorKey: "position",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Position" />
    ),
  },

  {
    accessorKey: "contactNumber",
    header: "ContactNumber_",
    cell: ({ row }) => {
      const contactNumber = row.getValue('contactNumber') as string;
      const formattedNumber = formatContactNumber(contactNumber);

      const handleCopyClick = () => {
        onCopy(formattedNumber);
        toast.success("Copied");
      };

      return (
        <ActionTooltip label="Copy" side="right">
          <div
            className={`flex border  rounded-md items-center bg-gray-50 cursor-pointer justify-center `}
            onClick={handleCopyClick}>
            <span>{formattedNumber}</span>
          </div>
        </ActionTooltip>
      );
    }
  },
  {
    accessorKey: "birthday",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Birthday" />
    ),
    cell: ({ row }) => {
      const birthday = row.getValue('birthday') as string; // Ensure the type is correct
      return getBirthday(birthday); // Format date as needed
    }
  },

  {
    accessorKey: "birthday",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Age" />),
    cell: ({ row }) => (

      <span><AgeCell birthday={row.original.birthday} /></span>
    ),
  },

  {
    accessorKey: "dateHired",
    header: "Year(s)of Service ",
    cell: ({ row }) => (
      <span><YearsOfService year_service={row.original.dateHired} /></span>
    ),
  },
  {
    accessorKey: "offices",
    header: "Office",
    cell: ({ row }) => (
      row.original.offices ? row.original.offices.name : "N/A"
    ),
  },
  {
    accessorKey: "education",
    header: "Education",
    cell: ({ row }) => (
      row.original.education ? row.original.education : "N/A"
    ),
  },
  {
    accessorKey: "eligibility",
    header: "Eligibility",
    cell: ({ row }) => (
      row.original.eligibility ? row.original.eligibility.name : "N/A"
    ),
  },
  {
    accessorKey: "employeeType",
    header: "Appointment",
    cell: ({ row }) => (
      row.original.employeeType ? row.original.employeeType.name : "N/A"
    ),
  },

  {
    accessorKey: "gender",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gender" />
    ),
  },
  {
    accessorKey: "salary",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Salary" />
    ),
    cell: ({ row }) => {
      const salary = row.getValue('salary') as string;
      return formatSalary(salary);
    }
  },
  {
    accessorKey: "salaryGrade",
    header: ({ column }) => (
      <DataTableColumnHeader column={column}
        title="Grade"
      />
    ),
    cell: ({ row }) => row.getValue("salaryGrade") || "N/A"
  },

  {
    accessorKey: "tinNo",
    header: "TaxpayerIdentificationNo",
    cell: ({ row }) => (
      row.original.tinNo ? row.original.tinNo : "N/A"
    )
  },
  {
    accessorKey: "gsisNo",
    header: "GSISNumber ",
    cell: ({ row }) => {
      const gsisNumber = row.getValue('gsisNo') as string; 
      return formatGsisNumber(gsisNumber); 
    }
  },
  {
    accessorKey: "philHealthNo",
    header: "PhilhealthNumber",
    cell: ({ row }) => {
      const PhilhealthNumber = row.getValue('philHealthNo') as string; 
      return formatPhilHealthNumber(PhilhealthNumber); 
    }
  },
  {
    accessorKey: "pagIbigNo",
    header: "PagibigNumber__",
    cell: ({ row }) => {
      const PagibigNumber = row.getValue('pagIbigNo') as string; 
      return formatPagIbigNumber(PagibigNumber); 
    }
  },

  {
    accessorKey: "dateHired",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DateHired" />
    ),
    cell: ({ row }) => {
      const dateHired = row.getValue('dateHired') as string; // Ensure the type is correct
      return formatDate(dateHired); // Format date as needed
    }
  },
  {
    accessorKey: "isFeatured",
    header: "Featured",
  },
  {
    accessorKey: "isArchived",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Archived" />
    )
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title=" CreatedAt" />
    ),
  },


]
