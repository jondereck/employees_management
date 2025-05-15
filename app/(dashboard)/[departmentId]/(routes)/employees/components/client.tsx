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
  eligibilities: { id: string; name: string, value: string  }[];
  employeeTypes: { id: string; name: string, value: string  }[];
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
  // Filter employees by IDs
  const filteredEmployees = useMemo(() => {
    return data.filter((employee) => {
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
    <div className="flex flex-col min-h-screen px-4 sm:px-6 lg:px-8 py-6 gap-6 bg-gray-50">
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

      {/* FILTER CONTROLS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border">
    
 

      {/* Search & Download Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="w-full md:flex-1">
          <SearchFilter searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </div>
        <EmployeeFilters
          offices={offices}
          eligibilities={eligibilities}
          employeeTypes={employeeTypes}
          onFilterChange={setFilters}
        />
        <div className="w-full md:w-auto ml-auto">
          <DownloadEmployeeBackup />
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
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <Button onClick={() => document.getElementById("open-filters")?.click()} className="rounded-full shadow-lg px-4 py-3">
          Filter
        </Button>
      </div>
      <Footer />
    </div>



  );
}

