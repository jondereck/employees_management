"use client"

import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { ArrowUpDown, Copy } from "lucide-react"
import { CellAction } from "./cell-actions"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import PreviewModal from "../../(frontend)/view/components/preview"
import { Eye } from "./eye"
import { parse } from "date-fns"
import { useState } from "react"
import toast from "react-hot-toast"
import { ActionTooltip } from "@/components/ui/action-tooltip"




// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export interface Offices {
  id: string;
  name: string;
}

export interface Image {
  id: string;
  url: string;
  value: EmployeeType;
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
  offices: Offices;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  gender: string;
  contactNumber: string;
  position: string;
  birthday: string;
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
  eligibility: Eligibility;
  employeeType: EmployeeType;
  images: Image[];
  region: string;
  province: string;
  city: string;
  barangay: string;
  houseNo: string;
  salaryGrade: string;
  memberPolicyNo: string;

}

const calculateAge = (birthdate: string) => {
  // Parse the birthdate using date-fns parse function
  const parsedBirthdate = parse(birthdate, 'MMMM do, yyyy', new Date());

  if (isNaN(parsedBirthdate.getTime())) {
    console.log("Invalid birthdate:", birthdate);
    return null;
  }

  const today = new Date();

  const age = today.getFullYear() - parsedBirthdate.getFullYear();
  const monthDiff = today.getMonth() - parsedBirthdate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsedBirthdate.getDate())) {
    return age - 1;
  }

  return age;
};

const onCopy = (text: string) => {
  navigator.clipboard.writeText(text);
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
  {
    id: "eye",
    cell: ({ row }) => <Eye data={row.original} />
  },
  // {
  //   accessorKey: "lastName",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="Last Name" />
  //   ),
  // },
  {
    accessorKey: "lastName", // Change this to a custom accessor key like "fullName"
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Full Name" />
    ),
    cell: ({ row }) => {
      
      const capitalizeFirstLetter = (str: string) => {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      };

      let firstName = '';
      if (row.original.firstName) {
        const firstNameWords = row.original.firstName.split(' ');
        firstName = firstNameWords.map(word => capitalizeFirstLetter(word)).join(' ');
      }

      let middleNameInitials = '';
      if (row.original.middleName) {
        const middleNameWords = row.original.middleName.split(' ');
        middleNameInitials = middleNameWords.map(word => word.charAt(0).toUpperCase()).join('');
      }

      let lastName = '';
      if (row.original.lastName) {
        const lastNameWords = row.original.lastName.split(' ');
        lastName = lastNameWords.map(word => capitalizeFirstLetter(word)).join(' ');
      }

      const suffix = capitalizeFirstLetter(row.original.suffix);

      const getTitle = (gender: string) => {
        return gender === 'Male' ? 'Mr.' : 'Ms.';
      };

      const title = getTitle(row.original.gender);

      
      const position = row.original.position
      const fullName = `${title} ${firstName} ${middleNameInitials}. ${lastName}${suffix}, ${position}`;

     

      const handleCopyClick = () => {
        onCopy(fullName);
        
        toast.success("Copied")
        // Reset copied state after 2 seconds
        
      };

      return (
        <ActionTooltip
          label="Copy"
          side="right"
        >
          <div 
         className={`flex border p-1 rounded-md items-center bg-gray-50 cursor-pointer justify-center `}
        onClick={handleCopyClick}>
          <span>{`${firstName} ${middleNameInitials}. ${lastName} ${suffix}`}</span>
          
        </div>
        </ActionTooltip>
        
      );
    },
  },

  

  {
    accessorKey: "position",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Position" />
    ),
  },
  // {
  //   accessorKey: "firstName",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="First Name" />
  //   ),
  // }, 
  // {
  //   accessorKey: "middleName",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="Middle Name" />
  //   ),
  // }, 
  // {
  //   accessorKey: "suffix",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="Suffix" />
  //   ),
  // },
  {
    accessorKey: "birthday",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Age" />
    ),
    cell: ({ row }) => (
      <span>{calculateAge(row.original.birthday)}</span>
    ),
  },
  {
    accessorKey: "offices",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Department" />
    ),
    cell: ({ row }) => (
      row.original.offices ? row.original.offices.name : "N/A"
    ),
  },
  {
    accessorKey: "eligibility",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Eligibility" />
    ),
    cell: ({ row }) => (
      row.original.eligibility ? row.original.eligibility.name : "N/A"
    ),
  },
  {
    accessorKey: "employeeType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Appointment" />
    ),
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
    accessorKey: "contactNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact Number" />
    ),
  },
  
  // {
  //   accessorKey: "birthday",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="Birthday" />
  //   ),
  // },
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
    accessorKey: "pagIbigNo",
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
