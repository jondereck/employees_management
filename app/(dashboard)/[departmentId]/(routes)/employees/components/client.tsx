"use client";

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  Loader2, 
  Plus, 
  Users, 
  UserCheck, 
  UserMinus, 
  LayoutGrid, 
  FilterX 
} from "lucide-react";
import clsx from "clsx";

// UI Components from your library
import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import ApiList from "@/components/ui/api-list";

// Custom Components
import SearchFilter from "@/components/search-filter";
import EmployeeFilters from "./employee-filters";
import { FloatingSelectionBar } from "./floating-selection-bar";
import DownloadEmployeeBackup from "@/components/download-button";
import Footer from "../../(frontend)/view/components/footer";

// Hooks & Types
import { useEmployees } from "@/hooks/use-employees";
import { useDebounce } from "@/hooks/use-debounce";
import { columns, EmployeesColumn } from "./columns";

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

export const EmployeesClient = ({ 
  departmentId, 
  data, 
  offices, 
  eligibilities, 
  employeeTypes 
}: EmployeesClientProps) => {
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  // --- State ---
  const SEARCH_STORAGE_KEY = "employees_search_v1";
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = localStorage.getItem(SEARCH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : "";
    } catch { return ""; }
  });

  const [filters, setFilters] = useState({
    offices: [] as string[],
    eligibilities: [] as string[],
    employeeTypes: [] as string[],
    positions: [] as string[],
    status: "all" as StatusValue,
  });

  const { employees: swrEmployees = [], isLoading } = useEmployees(departmentId);
  const debouncedSearchTerm = useDebounce(searchTerm, 400);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(searchTerm));
  }, [searchTerm]);

  // --- Data Merging & Sorting ---
  const employees = useMemo(() => {
    const source = swrEmployees.length > 0 ? swrEmployees : data;
    return source.map((emp: any) => ({
      ...emp,
      // Normalize dates for display if they exist
      displayBirthday: emp.birthday ? format(new Date(emp.birthday), "MMM d, yyyy") : "",
      displayHired: emp.dateHired ? format(new Date(emp.dateHired), "MMM d, yyyy") : "",
    })).sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [swrEmployees, data]);

  // --- Dynamic Position Options ---
  const activePositionOptions = useMemo(() => {
    const seen = new Set<string>();
    return employees
      .filter(e => !e.isArchived)
      .reduce((acc: Option[], e) => {
        const p = (e.position || "").trim();
        if (p && !seen.has(p.toLowerCase())) {
          seen.add(p.toLowerCase());
          acc.push({ id: p, name: p });
        }
        return acc;
      }, [])
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // --- Comprehensive Filtering ---
  const filteredData = useMemo(() => {
    const norm = (s?: string) => (s ?? "").toLowerCase().trim();
    const q = norm(debouncedSearchTerm);

    return employees.filter((emp) => {
      // 1. Hard Filters (Sidebar)
      const officeMatch = filters.offices.length === 0 || filters.offices.includes(emp.offices.id);
      const eligMatch = filters.eligibilities.length === 0 || filters.eligibilities.includes(emp.eligibility.id);
      const typeMatch = filters.employeeTypes.length === 0 || filters.employeeTypes.includes(emp.employeeType.id);
      const statusMatch = filters.status === "all" || (filters.status === "Active" ? !emp.isArchived : emp.isArchived);
      
      const posFilterMatch = filters.positions.length === 0 || 
        filters.positions.some(p => norm(emp.position).includes(norm(p)));

      if (!officeMatch || !eligMatch || !typeMatch || !statusMatch || !posFilterMatch) return false;

      // 2. Search Commands (?pos, ?note) or General Search
      if (q.startsWith("?pos")) {
        const query = q.replace("?pos", "").trim();
        return norm(emp.position).includes(query);
      }
      if (q.startsWith("?note")) {
        const query = q.replace("?note", "").trim();
        return norm(emp.note).includes(query);
      }
      if (q.startsWith("?off")) {
        const query = q.replace("?off", "").trim();
        return norm(emp.offices.name).includes(query);
      }

      // Default Global Search
      return (
        norm(`${emp.firstName} ${emp.lastName}`).includes(q) ||
        norm(emp.employeeNo).includes(q) ||
        norm(emp.nickname).includes(q) ||
        norm(emp.contactNumber).includes(q)
      );
    });
  }, [employees, debouncedSearchTerm, filters]);

  // --- Stats Calculation ---
  const stats = useMemo(() => ({
    total: filteredData.length,
    active: filteredData.filter(e => !e.isArchived).length,
    inactive: filteredData.filter(e => e.isArchived).length
  }), [filteredData]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f9fafb]">
      {/* Top Header Section */}
      <header className="bg-white border-b   shadow-sm px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Heading 
            title={`Employees (${stats.total})`} 
            description="Manage your workforce, track positions, and view history." 
          />
          <div className="flex items-center gap-3">
            <DownloadEmployeeBackup />
            <Button 
              onClick={() => startTransition(() => router.push(`/${params.departmentId}/employees/new`))}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-95"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Employee
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Headcount" value={stats.total} icon={Users} color="text-indigo-600" bg="bg-indigo-50" />
          <StatCard label="Active Status" value={stats.active} icon={UserCheck} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard label="Archived/Inactive" value={stats.inactive} icon={UserMinus} color="text-rose-600" bg="bg-rose-50" />
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-white rounded-2xl border shadow-sm p-2 flex flex-col lg:flex-row items-center gap-3">
          <div className="w-full lg:flex-1">
            <SearchFilter 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              isDebouncing={searchTerm !== debouncedSearchTerm} 
            />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-3">
            <EmployeeFilters
              offices={offices}
              eligibilities={eligibilities}
              employeeTypes={employeeTypes}
              positions={activePositionOptions}
              onFilterChange={setFilters}
            />
          </div>
        </div>

        {/* Data Table Area */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden min-h-[500px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-slate-400">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <p className="text-sm font-medium animate-pulse">Syncing employee records...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-center p-6">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <FilterX className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No employees found</h3>
              <p className="text-slate-500 max-w-xs mx-auto">
                We couldnt find any results matching your current search or filter criteria.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => { setSearchTerm(""); setFilters({ offices: [], eligibilities: [], employeeTypes: [], positions: [], status: "all" }); }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="p-1">
              <DataTable
                columns={columns}
                data={filteredData}
                storageKey="employees_table_v1"
                syncPageToUrl
                enableColumnReorder
                renderExtra={(table) => (
                  <FloatingSelectionBar table={table} departmentId={departmentId} />
                )}
              />
            </div>
          )}
        </div>

        <ApiList entityIdName="employeesId" entityName="employees" />
      </main>
      
      <Footer />
    </div>
  );
};

// --- Helper UI Components ---

const StatCard = ({ label, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
    <div className={clsx("p-3.5 rounded-xl shrink-0", bg, color)}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-slate-900">{value}</span>
        <span className="text-[10px] text-slate-400 font-medium italic">records</span>
      </div>
    </div>
  </div>
);

export default EmployeesClient;