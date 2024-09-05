

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
  employeeNo: string;
  offices: Offices;
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
  age: string;
  prefix: string;
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

// const renderHeader = (column:any) => {
//   return (
//     <Button
//       variant="ghost"
//       onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
//     >
//       {column.header}
//       <ArrowUpDown className="ml-2 h-4 w-4" />
//     </Button>
//   );
// };


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
    accessorKey: "firstName", // Change this to a custom accessor key like "fullName"
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="FirstName" />
    ),
    cell: ({ row }) => {

      const capitalizeFirstLetter = (str: string) => {
        if (str) {
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        }
        return '';
      };

      // let prefix = '';
      // if (row.original.prefix) {
      //   const prefixWords = row.original.prefix.split(' ');
      //   prefix = prefixWords.map(word => capitalizeFirstLetter(word)).join(' ');
      // }
      const firstName2 = row.original.firstName

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

      const getTitle = (gender: string, prefix: string | undefined) => {
        if (prefix) {
          const prefixWords = prefix.split(' ');
          const capitalizedPrefix = prefixWords.map(word => capitalizeFirstLetter(word)).join(' ');
          return capitalizedPrefix;
          return prefix;
        } else {
          // If prefix doesn't exist, determine title based on gender
          return gender === 'Male' ? 'Mr.' : 'Ms.';
        }
      };

      const title = getTitle(row.original.gender, row.original.prefix);


      const position = row.original.position
      const fullName = `${title} ${firstName} ${middleNameInitials}. ${lastName}${suffix ? ` ${suffix}` : ``}, ${position}`;


      const handleCopyClick = () => {
        let copiedText = fullName;
        if (row.original.employeeType && row.original.employeeType.name === 'Job Order') {
          copiedText += ' (Job Order)';
        }
        onCopy(copiedText);
        toast.success("Copied");
      };
      return (
        <ActionTooltip
          label="Copy"
          side="right"
        >
          <div
            className={`flex border p-1 rounded-md items-center bg-gray-50 cursor-pointer justify-center `}
            onClick={handleCopyClick}>
            <span>{`${firstName2} 
        `

            }</span>

          </div>
        </ActionTooltip>
        // ${middleNameInitials}. 
        // ${lastName} 
        // ${suffix}
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
    header: ({column}) => (
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

  // {
  //   accessorKey: "age",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="Age2" />
  //   ),
  // },
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
    accessorKey: "contactNumber",
    header: "ContactNumber",
    cell: ({ row }) => {

      const formatNumber = (number:string) => {
        if (!number || number.length !== 11) return number;
        return `${number.slice(0,4)} ${number.slice(4,7)} ${number.slice(7)}`;
      };
      
      const number =  row.original.contactNumber ? formatNumber(row.original.contactNumber) : "N/A"

      const handleCopyClick = () => {
        onCopy(number);
        toast.success("Copied");
      };

      return (
        <ActionTooltip label="Copy" side="right">
          <div
            className={`flex border  rounded-md items-center bg-gray-50 cursor-pointer justify-center `}
            onClick={handleCopyClick}>
            <span>{number}</span>
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
      const birthdayString: string = row.original.birthday;
      console.log('Original birthday string:', birthdayString);
  
      const birthday = parseDate(birthdayString);
      console.log('Parsed birthday:', birthday);
  
      if (!birthday) {
        console.log('Invalid date detected');
        return 'Invalid date';
      }
  
      const nextDayBirthday = birthday.add(1, 'day');
      console.log('Next day birthday:', nextDayBirthday);
  
      return nextDayBirthday.format('MMMM DD, YYYY'); // or any desired format
    },
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


  // {
  //   accessorKey: "birthday",
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="Birthday" />
  //   ),
  // },

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
    cell: ({ row }) => (
      row.original.gsisNo ? row.original.gsisNo : "N/A"
    )
  },
  {
    accessorKey: "philHealthNo",
    header: "PhilhealthNumber",
    cell: ({ row }) => (
      row.original.philHealthNo ? row.original.philHealthNo : "N/A"
    )
  },
  {
    accessorKey: "pagIbigNo",
    header: "PagibigNumber",
    cell: ({ row }) => (
      row.original.pagIbigNo ? row.original.pagIbigNo : "N/A"
    )
  },

  {
    accessorKey: "dateHired",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DateHired" />
    ),
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
