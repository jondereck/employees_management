"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Eligibility, EmployeeType, EmployeesColumn, Offices, columns } from "./columns";

import useSWR from 'swr';
import { useEmployees } from "@/hooks/use-employees";
import { useDebounce } from "@/hooks/use-debounce"; 


import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import ApiList from "@/components/ui/api-list";
import ApiHeading from "@/components/ui/api-heading";
import Footer from "../../(frontend)/view/components/footer";
import DownloadEmployeeBackup from "@/components/download-button";
import React, { useState, useMemo } from 'react';
import SearchFilter from "@/components/search-filter";
import BirthdayNotifications from "./notifications";
import Notifications from "./notifications";
import { OfficesColumn } from "../../offices/components/columns";
import EmployeeFilters from "./employee-filters";
import { format } from "date-fns";





interface EmployeesClientProps {
  departmentId: string; // ✅ Add this instead to build your SWR URL
  data?:EmployeesColumn[];
  offices: { id: string; name: string }[];
  eligibilities: { id: string; name: string; value: string }[];
  employeeTypes: { id: string; name: string; value: string }[];
}


export const EmployeesClient = ({ departmentId, data, offices, eligibilities, employeeTypes
}: EmployeesClientProps) => {
  const router = useRouter();
  const params = useParams();

  const [filters, setFilters] = useState({
    offices: [] as string[],
    eligibilities: [] as string[],
    employeeTypes: [] as string[],
    status: "all",
  });

 const { employees: swrEmployees = [], isLoading, isError } = useEmployees(departmentId);

const employees = useMemo(() => {
  const raw = swrEmployees.length > 0 ? swrEmployees : (data ?? []);

  const formatted = raw.map((emp) => ({
    ...emp,
    birthday: emp.birthday ? format(new Date(emp.birthday), "M d, yyyy") : '',
    dateHired: emp.dateHired ? format(new Date(emp.dateHired), "M d, yyyy") : '',
  }));

  // Sort by updatedAt (desc), fallback to createdAt if updatedAt is missing
  return formatted.sort((a, b) => {
    const dateA = new Date((a as any).updatedAt || (a as any).createdAt).getTime();
    const dateB = new Date((b as any).updatedAt || (b as any).createdAt).getTime();
    return dateB - dateA;
  });
}, [swrEmployees, data]);


  // Filter employees by IDs
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const officeMatch =
        filters.offices.length === 0 || filters.offices.includes(employee.offices.id);
      const eligMatch =
        filters.eligibilities.length === 0 || filters.eligibilities.includes(employee.eligibility.id);
      const typeMatch =
        filters.employeeTypes.length === 0 || filters.employeeTypes.includes(employee.employeeType.id);
      const statusMatch =
        filters.status === "all" ||
        (filters.status === "Active" && !employee.isArchived) ||
        (filters.status === "Inactive" && employee.isArchived);

      return officeMatch && eligMatch && typeMatch && statusMatch;
    });
  }, [employees, filters]);


  // State for search input
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);

  // Filter data based on the search term
const filteredData = useMemo(() => {
  const lower = debouncedSearchTerm.toLowerCase();

  return filteredEmployees.filter((employee) => {
    const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
    const reversedName = `${employee.lastName} ${employee.firstName}`.toLowerCase();
    const contactNumber = employee.contactNumber?.toLowerCase() || "";
    const nickname = employee.nickname?.toLowerCase() || "";
    const employeeNo = employee.employeeNo?.toLowerCase() || "";

    return (
      fullName.includes(lower) ||
      reversedName.includes(lower) ||
      contactNumber.includes(lower) ||
      nickname.includes(lower) ||
      employeeNo.includes(lower)
    );
  });
}, [filteredEmployees, debouncedSearchTerm]);




  return (
    <div className="flex flex-col min-h-screen px-4 sm:px-4 lg:px-6 py-6 gap-6 bg-gray-50">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <Heading
          title={`Employees (${filteredData.length})`}
          description="This count includes retirees/terminated."
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push(`/${params.departmentId}/employees/new`)}
            className="flex items-center gap-2 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          {/* Optional: Notification bell or badge here */}
        </div>
      </div>

      <Separator />

      <div className="bg-white p-4 rounded-2xl shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center md:gap-4 gap-3 w-full">
          <div className="flex flex-row items-center gap-2 w-full">
            {/* Search Input */}
            <div className="flex-1">
              <SearchFilter searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
            </div>
            {/* Download Button */}
            <div className="w-auto">
              <DownloadEmployeeBackup />
            </div>
          </div>

          {/* Filters beside or below */}
          <div className="w-full md:w-auto">
            <EmployeeFilters
              offices={offices}
              eligibilities={eligibilities}
              employeeTypes={employeeTypes}
              onFilterChange={setFilters}
            />
          </div>
        </div>


      </div>
      {/* Data Table */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border">
        {filteredData.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            No employees match your filters or search.
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl shadow-sm border">
            <DataTable
              columns={columns}
              data={filteredData}
              offices={offices}
              eligibilities={eligibilities}
              employeeTypes={employeeTypes}
            />
          </div>
        )}
      </div>
      <ApiList entityIdName="employeesId" entityName="employees" />
      <Footer />
    </div>



  );
}

