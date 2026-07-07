"use client";

import React, { useState, useMemo, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Menu,
  Plus,
  Users,
  UserCheck,
  UserMinus,
  FilterX
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

// UI Components from your library
import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { DataTable } from "@/components/ui/data-table";
import { DataTableViewOptions } from "@/components/ui/column-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Custom Components
import SearchFilter from "@/components/search-filter";
import EmployeeFilters from "./employee-filters";
import { FloatingSelectionBar } from "./floating-selection-bar";
import DownloadEmployeeBackup from "@/components/download-button";
import { CellAction } from "./cell-actions";

// Hooks & Types
import { useEmployees } from "@/hooks/use-employees";
import { useDebounce } from "@/hooks/use-debounce";
import { columns, EmployeesColumn } from "./columns";
import { formatContactNumber } from "@/utils/utils";
import usePreviewModal from "../../(frontend)/view/hooks/use-preview-modal";

interface Option { id: string; name: string; }
const STATUS_VALUES = ["all", "Active", "Inactive"] as const;
type StatusValue = typeof STATUS_VALUES[number];
type GenderValue = "all" | "Male" | "Female";

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
  const [viewOptionsPayload, setViewOptionsPayload] = useState<{
    table: any;
    onResetColumns: () => void;
    canReset: boolean;
  } | null>(null);
  const [mobilePageIndex, setMobilePageIndex] = useState(0);
  const mobilePageSize = 10;
  const previewModal = usePreviewModal();
  const copyPhoneNumber = useCallback(async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Phone number copied", {
        description: value,
      });
    } catch {
      toast.error("Copy failed", {
        description: "Could not copy phone number.",
      });
    }
  }, []);

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
    gender: "all" as GenderValue,
    sgMin: null as number | null,
    sgMax: null as number | null,
    salaryMin: null as number | null,
    salaryMax: null as number | null,
  });

  const { employees: swrEmployees = [], isLoading } = useEmployees(departmentId);
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const handleViewOptionsReady = useCallback((payload: {
    table: any;
    onResetColumns: () => void;
    canReset: boolean;
  }) => {
    setViewOptionsPayload(payload);
  }, []);

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
      const queueA = new Date(a.idQueueAt || 0).getTime();
      const queueB = new Date(b.idQueueAt || 0).getTime();
      if (queueA !== queueB) return queueB - queueA;
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
      const genderMatch = filters.gender === "all" || emp.gender === filters.gender;
      const sg = Number(emp.salaryGrade) || 0;
      const sgMinMatch = filters.sgMin === null || sg >= filters.sgMin;
      const sgMaxMatch = filters.sgMax === null || sg <= filters.sgMax;
      const sal = Number(emp.salary) || 0;
      const salMinMatch = filters.salaryMin === null || sal >= filters.salaryMin;
      const salMaxMatch = filters.salaryMax === null || sal <= filters.salaryMax;

      if (!officeMatch || !eligMatch || !typeMatch || !statusMatch || !posFilterMatch ||
          !genderMatch || !sgMinMatch || !sgMaxMatch || !salMinMatch || !salMaxMatch) return false;

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

  const mobilePageCount = Math.max(1, Math.ceil(filteredData.length / mobilePageSize));
  const mobileCurrentPage = Math.min(mobilePageIndex, mobilePageCount - 1);
  const mobilePageData = useMemo(() => {
    const start = mobileCurrentPage * mobilePageSize;
    return filteredData.slice(start, start + mobilePageSize);
  }, [filteredData, mobileCurrentPage]);

  useEffect(() => {
    setMobilePageIndex(0);
  }, [searchTerm, filters]);

  useEffect(() => {
    if (mobilePageIndex > mobilePageCount - 1) {
      setMobilePageIndex(Math.max(0, mobilePageCount - 1));
    }
  }, [mobilePageCount, mobilePageIndex]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f9fafb]">
      {/* Top Header Section */}
      <header className="bg-white border-b shadow-sm px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-[1880px] space-y-3 sm:space-y-4">
          <div className="flex items-start justify-between gap-3 sm:hidden">
            <div className="min-w-0">
              <h1 className="text-[34px] font-extrabold leading-none tracking-tight text-slate-900">Employees</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your workforce, track positions, and view history.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
            <Heading
              title={`Employees`}
              description="Manage your workforce, track positions, and view history."
            />
            <div className="flex items-center justify-end gap-3">
              <DownloadEmployeeBackup />
              <Button
                onClick={() => startTransition(() => router.push(`/${params.departmentId}/employees/new`))}
                disabled={isPending}
                className="h-10 bg-indigo-600 text-white shadow-md transition-all active:scale-95 hover:bg-indigo-700"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Employee
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:hidden">
            <Button
              onClick={() => startTransition(() => router.push(`/${params.departmentId}/employees/new`))}
              disabled={isPending}
              className="h-11 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-500 text-white shadow-md transition-all active:scale-[0.99] hover:from-indigo-700 hover:to-indigo-600"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Employee
            </Button>
            <div className="[&>div]:w-full [&>div>button]:h-11 [&>div>button]:w-full [&>div>button]:justify-center [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-emerald-700 [&>div>button]:text-white [&>div>button:hover]:bg-emerald-800">
              <DownloadEmployeeBackup />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1880px] flex-1 space-y-6 p-4 sm:p-5 lg:p-6">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Headcount" value={stats.total} icon={Users} color="text-indigo-600" bg="bg-indigo-50" />
          <StatCard label="Active Status" value={stats.active} icon={UserCheck} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard label="Archived/Inactive" value={stats.inactive} icon={UserMinus} color="text-rose-600" bg="bg-rose-50" />
        </div>

        {/* Filter & Search Toolbar */}
        <div className="sticky top-[64px] z-20 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex items-center gap-2 sm:hidden">
            <div className="min-w-0 flex-1">
              <SearchFilter 
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
                isDebouncing={searchTerm !== debouncedSearchTerm} 
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl border-slate-200 bg-white text-slate-600"
                  aria-label="Open search actions"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-2">
                <div className="space-y-2">
                  <div className="[&>div]:w-full [&>div>button]:w-full [&>div>button]:justify-start">
                    <EmployeeFilters
                      offices={offices}
                      eligibilities={eligibilities}
                      employeeTypes={employeeTypes}
                      positions={activePositionOptions}
                      onFilterChange={setFilters}
                    />
                  </div>
                  {viewOptionsPayload ? (
                    <div className="[&>button]:ml-0 [&>button]:w-full [&>button]:justify-start">
                      <DataTableViewOptions
                        table={viewOptionsPayload.table}
                        onResetColumns={viewOptionsPayload.onResetColumns}
                        canReset={viewOptionsPayload.canReset}
                      />
                    </div>
                  ) : null}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="hidden sm:flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <div className="min-w-[220px] flex-1">
              <SearchFilter 
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
                isDebouncing={searchTerm !== debouncedSearchTerm} 
              />
            </div>
            <div className="h-8 w-px shrink-0 bg-slate-200" />
            <EmployeeFilters
              offices={offices}
              eligibilities={eligibilities}
              employeeTypes={employeeTypes}
              positions={activePositionOptions}
              onFilterChange={setFilters}
            />
            {viewOptionsPayload ? (
              <div className="[&>button]:ml-0">
                <DataTableViewOptions
                  table={viewOptionsPayload.table}
                  onResetColumns={viewOptionsPayload.onResetColumns}
                  canReset={viewOptionsPayload.canReset}
                />
              </div>
            ) : null}
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
                onClick={() => { setSearchTerm(""); setFilters({ offices: [], eligibilities: [], employeeTypes: [], positions: [], status: "all", gender: "all", sgMin: null, sgMax: null, salaryMin: null, salaryMax: null }); }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="p-1">
              <div className="sm:hidden space-y-2.5 p-2">
                {mobilePageData.map((employee) => {
                  const fullName = `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim();
                  const initials = `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase() || "EM";
                  const statusText = employee.isArchived ? "Archived" : "Active";
                  const statusTone = employee.isArchived
                    ? "bg-rose-50 text-rose-600"
                    : "bg-emerald-50 text-emerald-600";
                  const dateLabel = employee.displayHired || "No hire date";
                  const phone = formatContactNumber(employee.contactNumber || "");
                  const avatarUrl = employee.images?.[0]?.url || null;

                  return (
                    <div
                      key={employee.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => previewModal.onOpen(employee)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          previewModal.onOpen(employee);
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt={fullName || "Employee photo"}
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{fullName || "Unnamed employee"}</p>
                            <p className="truncate text-xs text-slate-500">{employee.position || "No position"}</p>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                copyPhoneNumber(phone);
                              }}
                              className="truncate text-left text-xs text-slate-400 hover:text-slate-600 hover:underline"
                              title={phone ? "Tap to copy number" : "No contact number"}
                            >
                              {phone || "No contact number"}
                            </button>
                          </div>
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>
                          <CellAction data={employee} />
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusTone}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${employee.isArchived ? "bg-rose-500" : "bg-emerald-500"}`} />
                          {statusText}
                        </span>
                        {employee.idQueueAt ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            For ID
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-400">{dateLabel}</span>
                      </div>
                    </div>
                  );
                })}

                {filteredData.length > mobilePageSize ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                    <span className="text-xs text-slate-500">
                      Page {mobileCurrentPage + 1} of {mobilePageCount}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={mobileCurrentPage === 0}
                        onClick={() => setMobilePageIndex(0)}
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={mobileCurrentPage === 0}
                        onClick={() => setMobilePageIndex((prev) => Math.max(prev - 1, 0))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={mobileCurrentPage >= mobilePageCount - 1}
                        onClick={() => setMobilePageIndex((prev) => Math.min(prev + 1, mobilePageCount - 1))}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={mobileCurrentPage >= mobilePageCount - 1}
                        onClick={() => setMobilePageIndex(mobilePageCount - 1)}
                      >
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="hidden sm:block">
                <DataTable
                  columns={columns}
                  data={filteredData}
                  storageKey="employees_table_v1"
                  syncPageToUrl
                  enableColumnReorder
                  hideInternalViewOptions
                  onViewOptionsReady={handleViewOptionsReady}
                  renderExtra={(table) => (
                    <FloatingSelectionBar table={table} departmentId={departmentId} />
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* <ApiList entityIdName="employeesId" entityName="employees" /> */}
      </main>
      

    </div>
  );
};

// --- Helper UI Components ---

const StatCard = ({ label, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center gap-3 sm:gap-5 transition-all hover:shadow-md">
    <div className={clsx("p-2.5 sm:p-3.5 rounded-xl shrink-0", bg, color)}>
      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl sm:text-3xl font-black text-slate-900">{value}</span>
        <span className="text-[10px] text-slate-400 font-medium italic">records</span>
      </div>
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
  </div>
);

export default EmployeesClient;
