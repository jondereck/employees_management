"use client";
import PaginationControls from "@/components/ui/pagination-control";
import { Employees } from "../../../types";
import { useEffect, useState } from "react";
import NoResults from "../../../components/ui/no-results";
import EmployeeCard from "../../../components/ui/employee-card";


const EmployeePerPage = 12;

interface EmployeeListProps {
  items: Employees[];
}

const EmployeeList = ({
  items,
}: EmployeeListProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [displayedEmployee, setDisplayedEmployee] = useState<Employees[]>([]);
  const totalPages = Math.ceil(items.length / EmployeePerPage);


  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  useEffect(() => {
    const employeeSort = [...items].sort((a, b) => (b.isHead ? 1 : 0) - (a.isHead ? 1 : 0));
  
    // Calculate start and end indices based on currentPage
    const startIdx = (currentPage - 1) * EmployeePerPage;
    const endIdx = startIdx + EmployeePerPage;
  
    // Slice items to get displayed employees for the current page
    const employeeForPage = employeeSort.slice(startIdx, endIdx);
    setDisplayedEmployee(employeeForPage);
  
  }, [currentPage, items]);

  return (

    <>
      {displayedEmployee.length === 0 && <NoResults />}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {displayedEmployee.map((item) => (
          <EmployeeCard
            key={item.id}
            data={item}
          />
        ))}
        {/* <SearchInput/> */}
      </div>



      <>

        {items.length > EmployeePerPage && (
          <>

            <div className="flex justify-center items-center ">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </>
    </>
  );
}

export default EmployeeList;