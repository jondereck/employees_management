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
import React, { useState, useMemo, useEffect } from 'react';
import SearchFilter from "@/components/search-filter";
import BirthdayNotifications from "./notifications";
import Notifications from "./notifications";
import { OfficesColumn } from "../../offices/components/columns";
import EmployeeFilters from "./employee-filters";
import { format } from "date-fns";
import { FloatingSelectionBar } from "./floating-selection-bar";
import CsvAttendanceImport from "./csv-attendance-import";


interface Option { id: string; name: string; }

const STATUS_VALUES = ["all", "Active", "Inactive"] as const;
type StatusValue = typeof STATUS_VALUES[number];






interface EmployeesClientProps {
  departmentId: string;
  data: EmployeesColumn[];
  offices: Option[];
  eligibilities: { id: string; name: string; value: string }[];
  employeeTypes: { id: string; name: string; value: string }[];
  positions: Option[];
}

export const EmployeesClient = ({ departmentId, data, offices, positions, eligibilities, employeeTypes
}: EmployeesClientProps) => {
  const router = useRouter();
  const params = useParams();

  const SEARCH_STORAGE_KEY = "employees_search_v1";
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const [searchTerm, setSearchTerm] = useState<string>(() => {
  try {
    if (typeof window === "undefined") return "";
    const raw = localStorage.getItem(SEARCH_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : "";
    return typeof saved === "string" ? saved : "";
  } catch {
    return "";
  }
});

  // persist on change
  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(searchTerm));
    } catch { }
  }, [searchTerm]);

  //  // ✅ Escape clears search
  // useEffect(() => {
  //   const onKey = (e: KeyboardEvent) => {
  //     if (e.key === "Escape" && searchTerm) {
  //       setSearchTerm("");
  //     }
  //   };
  //   window.addEventListener("keydown", onKey);
  //   return () => window.removeEventListener("keydown", onKey);
  // }, [searchTerm]);

  const debouncedSearchTerm = useDebounce(searchTerm, 400);

  const [filters, setFilters] = useState({
    offices: [] as string[],
    eligibilities: [] as string[],
    employeeTypes: [] as string[],
    positions: [] as string[],       // <-- add this
    status: "all" as StatusValue,    // <-- strong type
  });
  const { employees: swrEmployees = [], isLoading, isError } = useEmployees(departmentId);

  
const employees = useMemo(() => {
  let merged: EmployeesColumn[];

  if (swrEmployees.length > 0) {
    merged = swrEmployees.map((emp) => ({
      id: emp.id,
      department: emp.departmentId,
      employeeNo: emp.employeeNo ?? "",
      offices: emp.offices,
      prefix: emp.prefix ?? "",
      firstName: emp.firstName ?? "",
      middleName: emp.middleName ?? "",
      lastName: emp.lastName ?? "",
      suffix: emp.suffix ?? "",
      gender: emp.gender ?? "",
      contactNumber: emp.contactNumber ?? "",
      position: emp.position ?? "",
      birthday: emp.birthday ? format(new Date(emp.birthday), "M d, yyyy") : "",
      education: emp.education ?? "",
      gsisNo: emp.gsisNo ?? "",
      tinNo: emp.tinNo ?? "",
      philHealthNo: emp.philHealthNo ?? "",
      pagIbigNo: emp.pagIbigNo ?? "",
      salary: typeof emp.salary === "number" ? String(emp.salary) : emp.salary ?? "",
      dateHired: emp.dateHired ? format(new Date(emp.dateHired), "M d, yyyy") : "",
      latestAppointment: emp.latestAppointment ?? "",
      terminateDate: emp.terminateDate ?? "",
      isFeatured: !!emp.isFeatured,
      isHead: !!emp.isHead,
      isArchived: !!emp.isArchived,
      eligibility: emp.eligibility,
      employeeType: emp.employeeType,
      images: emp.images ?? [],
      region: emp.region ?? "",
      province: emp.province ?? "",
      city: emp.city ?? "",
      barangay: emp.barangay ?? "",
      houseNo: emp.houseNo ?? "",
      salaryGrade: emp.salaryGrade?.toString() ?? "",
      salaryStep: emp.salaryStep?.toString() ?? "",
      memberPolicyNo: emp.memberPolicyNo ?? "",
      age: emp.age ?? "",
      nickname: emp.nickname ?? "",
      emergencyContactName: emp.emergencyContactName ?? "",
      emergencyContactNumber: emp.emergencyContactNumber ?? "",
      employeeLink: emp.employeeLink ?? "",
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt,
    })) as EmployeesColumn[];
  } else {
    merged = data ?? [];
  }

  return merged.sort((a, b) => {
    const dateA = new Date((a as any).updatedAt || (a as any).createdAt).getTime();
    const dateB = new Date((b as any).updatedAt || (b as any).createdAt).getTime();
    return dateB - dateA;
  });
}, [swrEmployees, data]);


// Unique positions from NON-archived employees only (case-insensitive, keep first casing)
const activePositionOptions: Option[] = useMemo(() => {
  const seen = new Set<string>();
  const list: Option[] = [];
  for (const e of employees) {
    if (e.isArchived) continue;                       // <-- exclude archived owners
    const p = (e.position ?? "").trim();
    if (!p) continue;
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push({ id: p, name: p });
    }
  }
  // sort by display name
  return list.sort((a, b) => a.name.localeCompare(b.name));
}, [employees]);


useEffect(() => {
  setFilters((prev) => {
    if (prev.positions.length === 0) return prev;
    const allowed = new Set(activePositionOptions.map(o => o.id));
    const next = prev.positions.filter(p => allowed.has(p));
    return next.length === prev.positions.length ? prev : { ...prev, positions: next };
  });
}, [activePositionOptions]);



  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const officeMatch =
        filters.offices.length === 0 || filters.offices.includes(employee.offices.id);

      const eligMatch =
        filters.eligibilities.length === 0 || filters.eligibilities.includes(employee.eligibility.id);

      const typeMatch =
        filters.employeeTypes.length === 0 || filters.employeeTypes.includes(employee.employeeType.id);

      const posMatch =
        filters.positions.length === 0 ||
        (!!employee.position &&
          filters.positions.some((selected) =>
            norm(employee.position).includes(norm(selected))
          ));

      const statusMatch =
        filters.status === "all" ||
        (filters.status === "Active" && !employee.isArchived) ||
        (filters.status === "Inactive" && employee.isArchived);

      return officeMatch && eligMatch && typeMatch && posMatch && statusMatch;
    });
  }, [employees, filters]);





  const filteredData = useMemo(() => {
    const raw = debouncedSearchTerm || "";
    const q = raw.trim();

    const isPosSearch = q.toLowerCase().startsWith("?pos");
    const posQuery = isPosSearch ? norm(q.replace(/^(\?pos)\s*/i, "")) : "";

    return filteredEmployees.filter((employee) => {
      if (isPosSearch) {
        const terms = posQuery.split(",").map((t) => norm(t)).filter(Boolean);
        const pos = norm(employee.position);
        return terms.length === 0 ? true : terms.some((t) => pos.includes(t));
      }

      const lower = norm(q);
      const fullName = norm(`${employee.firstName} ${employee.lastName}`);
      const reversedName = norm(`${employee.lastName} ${employee.firstName}`);
      const contactNumber = norm(employee.contactNumber);
      const nickname = norm(employee.nickname);
      const employeeNo = norm(employee.employeeNo);

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
              positions={activePositionOptions}
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
              renderExtra={(table) => <FloatingSelectionBar table={table} departmentId={departmentId} />}
            />

          </div>

        )}
      </div>

      <ApiList entityIdName="employeesId" entityName="employees" />
      <Footer />
    </div>



  );
}

