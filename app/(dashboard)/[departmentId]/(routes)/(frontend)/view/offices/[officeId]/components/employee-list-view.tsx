"use client";
import PaginationControls from "@/components/ui/pagination-control";
import { Employees } from "../../../types";
import { useEffect, useState } from "react";
import NoResults from "../../../components/ui/no-results";
import EmployeeCard from "../../../components/ui/employee-card";


const EmployeePerPage = 10;

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
    // Calculate start and end indices based on currentPage
    const startIdx = (currentPage - 1) * EmployeePerPage; // -13
    const endIdx = startIdx + EmployeePerPage; // 1

    // Slice items to get displayed bookmarks for the current page
    const bookmarksForPage = items.slice(startIdx, endIdx);
    setDisplayedEmployee(bookmarksForPage);

  }, [currentPage, items]);

  return (

    <>
      {displayedEmployee.length === 0 && <NoResults />}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item) => (
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