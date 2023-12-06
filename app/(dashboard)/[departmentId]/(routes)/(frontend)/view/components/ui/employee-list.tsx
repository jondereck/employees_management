"use client"

import { useEffect, useState } from "react";
import { Employees } from "../../types";
import EmployeeCard from "./employee-card";
import NoResults from "./no-results";
import PaginationControls from "@/components/ui/pagination-control";


const EmployeePerPage = 10;

interface EmployeeListProps {
  title: string;
  items: Employees[];
}

const EmployeeList = ({
  title,
  items,
}: EmployeeListProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [displayedEmployee, setDisplayedEmployee] = useState<Employees[]>([]);
  const totalPages = Math.ceil(items.length / EmployeePerPage);


  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  useEffect(() => {
    // Calculate start and end indices based on currentPage
    const startIdx = (currentPage - 1) * EmployeePerPage; // -13
    const endIdx = startIdx + EmployeePerPage; // 1

    // Slice items to get displayed bookmarks for the current page
    const bookmarksForPage = items.slice(startIdx, endIdx);
    setDisplayedEmployee(bookmarksForPage);

  }, [currentPage, items]);

  return (
    <div className="space-y-4 ">
      <h3 className="font-bold text-3xls">{title}</h3>
      {displayedEmployee.length === 0 && <NoResults/>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 space-x-2">
        {items.map((item) => (
          <EmployeeCard key={item.id} data={item} />
        ))}
      

      {items.length > EmployeePerPage && (
        <>
          <div className="flex justify-center items-center">
          <PaginationControls 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
          </div>
         </>
      )}
    </div></div>
  );
}

export default EmployeeList;