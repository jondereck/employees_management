"use client";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { EmployeesColumn, columns } from "./columns";


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
import BirthdayNotifications from "./birthday-notifications";





interface EmployeesClientProps {
  data: EmployeesColumn[];
}

export const EmployeesClient = ({ data
}: EmployeesClientProps) => {
  const router = useRouter();
  const params = useParams();

  // State for search input
  const [searchTerm, setSearchTerm] = useState("");

  // Filter data based on the search term
  const filteredData = data.filter((employee) => {
    const { firstName, lastName, contactNumber,nickname} = employee;
    const lowercasedSearchTerm = searchTerm.toLowerCase();

    const fullName = `${firstName} ${lastName}`.toLocaleLowerCase();
    const reversedFullName = `${lastName} ${firstName}`.toLocaleLowerCase();
    return (
      fullName.includes(lowercasedSearchTerm) ||
      reversedFullName.includes(lowercasedSearchTerm) ||
      contactNumber.toLowerCase().includes(lowercasedSearchTerm) ||
      nickname.toLowerCase().includes(lowercasedSearchTerm)
    );
  });



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
  <BirthdayNotifications data={data} />  
  </div>
</div>
    <Separator />
  
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
    <DataTable columns={columns} data={filteredData} />
    <ApiList entityIdName="employeesId" entityName="employees"/>
    <Footer />
  </div>
  

  );
}

