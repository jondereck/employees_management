"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Eligibility, EmployeeType, EmployeesColumn, Offices, columns } from "./columns";


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





interface EmployeesClientProps {
  data: EmployeesColumn[];
  offices: { id: string; name: string }[];
  eligibilities: { id: string; name: string }[];
  employeeTypes: { id: string; name: string }[];
}

export const EmployeesClient = ({ data, offices, eligibilities, employeeTypes
}: EmployeesClientProps) => {
  const router = useRouter();
  const params = useParams();

  const [filters, setFilters] = useState({
    offices: [] as string[],
    eligibilities: [] as string[],
    employeeTypes: [] as string[],
    status: "all",
  });


  const filteredEmployees = useMemo(() => {
    return data.filter((employee) => {
      const officeMatch =
        filters.offices.length === 0 || filters.offices.includes(employee.offices.name);
      const eligMatch =
        filters.eligibilities.length === 0 || filters.eligibilities.includes(employee.eligibility.name);
      const typeMatch =
        filters.employeeTypes.length === 0 || filters.employeeTypes.includes(employee.employeeType.name);
      const statusMatch =
        filters.status === "all" ||
        (filters.status === "Active" && !employee.isArchived) ||
        (filters.status === "Inactive" && employee.isArchived);

      return officeMatch && eligMatch && typeMatch && statusMatch;
    });
  }, [data, filters]);




  // State for search input
  const [searchTerm, setSearchTerm] = useState("");

  // Filter data based on the search term
  const filteredData = useMemo(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return filteredEmployees.filter((employee) => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      const reversedName = `${employee.lastName} ${employee.firstName}`.toLowerCase();
  
      return (
        fullName.includes(lowercasedSearchTerm) ||
        reversedName.includes(lowercasedSearchTerm) ||
        employee.contactNumber.toLowerCase().includes(lowercasedSearchTerm) ||
        employee.nickname.toLowerCase().includes(lowercasedSearchTerm)
      );
    });
  }, [filteredEmployees, searchTerm]);
  


  return (
    <div className="flex flex-col min-h-screen">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <Heading
          title={`Employees (${filteredData.length})`}
          description="This count includes retirees/terminated."
        />
  
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push(`/${params.departmentId}/employees/new`)} className="flex items-center gap-2">
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
          {/* Birthday Notification Bell */}
        </div>
      </div>
      <Separator />
     {/* FILTER CONTROLS */}
     {/* <EmployeeFilters
        offices={offices}
        eligibilities={eligibilities}
        employeeTypes={employeeTypes}
        onFilterChange={setFilters}
      /> */}


      {/* Search Input and Download Excel Button */}
      <div className="flex items-center gap-4 py-4">
        {/* Search Filter */}
        <div className="flex-1 w-full sm:w-auto">
          <SearchFilter searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </div>

        {/* Download Excel Button - pushed to the right */}
        <div className="ml-auto w-auto">
          <DownloadEmployeeBackup />
        </div>
      </div>

      {/* DataTable with filtered data */}
      <DataTable columns={columns} data={filteredData} offices={offices} eligibilities={eligibilities} employeeTypes={employeeTypes} />
      <ApiList entityIdName="employeesId" entityName="employees" />
      <Footer />
    </div>


  );
}

