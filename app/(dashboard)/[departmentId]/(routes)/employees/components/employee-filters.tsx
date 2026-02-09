"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  Filter, 
  X, 
  Check, 
  RotateCcw, 
  Briefcase, 
  Building2, 
  UserCircle, 
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/modal"; // Keep using your Modal or swap to a Sheet
import Chip from "./chip";
import clsx from "clsx";

interface Option { id: string; name: string; }
const STATUS_VALUES = ["all", "Active", "Inactive"] as const;
type StatusValue = typeof STATUS_VALUES[number];

interface EmployeeFiltersProps {
  offices: Option[];
  eligibilities: Option[];
  employeeTypes: Option[];
  positions: Option[];
  isGenioOpen?: boolean;
  onFilterChange: (filters: {
    offices: string[];
    eligibilities: string[];
    employeeTypes: string[];
    positions: string[];
    status: StatusValue;
  }) => void;
}

const STORAGE_KEY = "employee_filters_v1";

export default function EmployeeFilters({
  offices,
  eligibilities,
  employeeTypes,
  positions,
  isGenioOpen,
  onFilterChange,
}: EmployeeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Local state for modal editing
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedEligibilities, setSelectedEligibilities] = useState<string[]>([]);
  const [selectedEmployeeTypes, setSelectedEmployeeTypes] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusValue>("all");

  const activeCount = useMemo(() => {
    return selectedOffices.length + 
           selectedEligibilities.length + 
           selectedEmployeeTypes.length + 
           selectedPositions.length + 
           (status !== "all" ? 1 : 0);
  }, [selectedOffices, selectedEligibilities, selectedEmployeeTypes, selectedPositions, status]);

  // Persist & Hydrate logic (kept from your original for stability)
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      setSelectedOffices(saved.offices || []);
      setSelectedEligibilities(saved.eligibilities || []);
      setSelectedEmployeeTypes(saved.employeeTypes || []);
      setSelectedPositions(saved.positions || []);
      setStatus(saved.status || "all");
      onFilterChange(saved);
    }
  }, []);

  const handleApply = () => {
    const next = { offices: selectedOffices, eligibilities: selectedEligibilities, employeeTypes: selectedEmployeeTypes, positions: selectedPositions, status };
    onFilterChange(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIsOpen(false);
  };

  const clearAll = () => {
    const cleared = { offices: [], eligibilities: [], employeeTypes: [], positions: [], status: "all" as StatusValue };
    setSelectedOffices([]);
    setSelectedEligibilities([]);
    setSelectedEmployeeTypes([]);
    setSelectedPositions([]);
    setStatus("all");
    onFilterChange(cleared);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
    setIsOpen(false);
  };

  // Modern Multi-Select Item
  const FilterSection = ({ 
    label, 
    options, 
    selected, 
    onChange, 
    icon: Icon 
  }: { 
    label: string, 
    options: Option[], 
    selected: string[], 
    onChange: (ids: string[]) => void,
    icon: any 
  }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
        {selected.length > 0 && (
          <span className="ml-auto bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px]">
            {selected.length} selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => {
                onChange(isSelected ? selected.filter(id => id !== opt.id) : [...selected, opt.id]);
              }}
              className={clsx(
                "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all border",
                isSelected 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium" 
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50"
              )}
            >
              <span className="truncate">{opt.name}</span>
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className={clsx(
            "relative h-10 px-4 gap-2 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-all",
            activeCount > 0 && "border-indigo-200 bg-indigo-50/50 text-indigo-700"
          )}
        >
          <Filter className="h-4 w-4" />
          <span className="font-semibold text-sm">Filter</span>
          {activeCount > 0 && (
            <span className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1 shadow-sm ring-2 ring-white">
              {activeCount}
            </span>
          )}
        </Button>

        {activeCount > 0 && (
          <Button 
            variant="ghost" 
            onClick={clearAll}
            className="h-10 px-3 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      <Modal
        title="Filter Directory"
        description="Narrow down employees by category and status."
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      >
        <div className="space-y-8 py-4 max-h-[70vh] overflow-y-auto px-1">
          {/* Status Toggle (Modern Segmented Picker) */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <UserCircle className="h-4 w-4 text-slate-400" />
              Employment Status
            </label>
            <div className="flex p-1 bg-slate-100 rounded-xl">
              {STATUS_VALUES.map((val) => (
                <button
                  key={val}
                  onClick={() => setStatus(val)}
                  className={clsx(
                    "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
                    status === val ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FilterSection label="Offices" options={offices} selected={selectedOffices} onChange={setSelectedOffices} icon={Building2} />
            <FilterSection label="Appointment" options={employeeTypes} selected={selectedEmployeeTypes} onChange={setSelectedEmployeeTypes} icon={Briefcase} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FilterSection label="Eligibility" options={eligibilities} selected={selectedEligibilities} onChange={setSelectedEligibilities} icon={ShieldCheck} />
            <FilterSection label="Position Title" options={positions} selected={selectedPositions} onChange={setSelectedPositions} icon={Briefcase} />
          </div>
        </div>

        <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-6 border-t mt-6">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-slate-500">
            Cancel
          </Button>
          <Button onClick={handleApply} className="bg-indigo-600 hover:bg-indigo-700 px-8 shadow-md">
            Show {activeCount > 0 ? 'Filtered' : 'All'} Results
          </Button>
        </div>
      </Modal>

      {/* Floating Mobile Trigger */}
      {!isGenioOpen && (
        <div className="fixed bottom-24 right-6 z-50 md:hidden animate-in fade-in slide-in-from-bottom-4">
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center p-0"
          >
            <Filter className="h-6 w-6" />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-6 w-6 bg-rose-500 border-2 border-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}