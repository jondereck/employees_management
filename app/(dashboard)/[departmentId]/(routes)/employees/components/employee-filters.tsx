"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import Chip from "./chip";

interface Option {
  id: string;
  name: string;
}

interface EmployeeFiltersProps {
  offices: Option[];
  eligibilities: Option[];
  employeeTypes: Option[];
  onFilterChange: (filters: {
    offices: string[];
    eligibilities: string[];
    employeeTypes: string[];
    status: string;
  }) => void;
}

export default function EmployeeFilters({
  offices,
  eligibilities,
  employeeTypes,
  onFilterChange,
}: EmployeeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedEligibilities, setSelectedEligibilities] = useState<string[]>([]);
  const [selectedEmployeeTypes, setSelectedEmployeeTypes] = useState<string[]>([]);
  const [status, setStatus] = useState("all");

  const handleApply = () => {
    onFilterChange({
      offices: selectedOffices,
      eligibilities: selectedEligibilities,
      employeeTypes: selectedEmployeeTypes,
      status,
    });
    setIsOpen(false);
  };

  const clearAll = () => {
    updateFilters({
      offices: [],
      eligibilities: [],
      employeeTypes: [],
      status: "all",
    });
    setIsOpen(false); // optional: close modal
  };

  const updateFilters = ({
    offices,
    eligibilities,
    employeeTypes,
    status,
  }: {
    offices: string[];
    eligibilities: string[];
    employeeTypes: string[];
    status: string;
  }) => {
    setSelectedOffices(offices);
    setSelectedEligibilities(eligibilities);
    setSelectedEmployeeTypes(employeeTypes);
    setStatus(status);
    onFilterChange({ offices, eligibilities, employeeTypes, status }); // <- notify parent
  };
  

  // MultiSelect component: checkbox multi-select list
  const MultiSelect = ({
    options,
    selected,
    onChange,
  }: {
    options: Option[];
    selected: string[];
    onChange: (newSelected: string[]) => void;
  }) => {
    const toggle = (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id));
      } else {
        onChange([...selected, id]);
      }
    };

    const updateFilters = ({
      offices,
      eligibilities,
      employeeTypes,
      status,
    }: {
      offices: string[];
      eligibilities: string[];
      employeeTypes: string[];
      status: string;
    }) => {
      setSelectedOffices(offices);
      setSelectedEligibilities(eligibilities);
      setSelectedEmployeeTypes(employeeTypes);
      setStatus(status);
      onFilterChange({ offices, eligibilities, employeeTypes, status }); // <- notify parent
    };
    

    return (
      <div className="max-h-40 overflow-auto border rounded p-2">
        {options.map((option) => (
          <label key={option.id} className="flex items-center space-x-2 mb-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => toggle(option.id)}
            />
            <span>{option.name}</span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <>
    {/* Trigger Button (shown inline and mobile floating button will also use this) */}
    <Button
      onClick={() => setIsOpen(true)}
      id="open-filters"
      className="md:w-auto w-full"
    >
      Filter
    </Button>
  
    {/* Active Filters as Chips */}
    <div className="flex gap-2 mt-2 flex-wrap">
      {selectedOffices.map((id) => {
        const office = offices.find((o) => o.id === id);
        return office ? (
          <Chip
            key={id}
            onRemove={() =>
              updateFilters({
                offices: selectedOffices.filter((i) => i !== id),
                eligibilities: selectedEligibilities,
                employeeTypes: selectedEmployeeTypes,
                status,
              })
            }
            label={`Office: ${office.name}`}
          />
        ) : null;
      })}
      {selectedEligibilities.map((id) => {
        const elig = eligibilities.find((e) => e.id === id);
        return elig ? (
          <Chip
            key={id}
            onRemove={() =>
              updateFilters({
                offices: selectedOffices,
                eligibilities: selectedEligibilities.filter((i) => i !== id),
                employeeTypes: selectedEmployeeTypes,
                status,
              })
            }
            
            label={`Eligibility: ${elig.name}`}
          />
        ) : null;
      })}
      {selectedEmployeeTypes.map((id) => {
        const type = employeeTypes.find((t) => t.id === id);
        return type ? (
          <Chip
            key={id}
            onRemove={() =>
              updateFilters({
                offices: selectedOffices,
                eligibilities: selectedEligibilities,
                employeeTypes: selectedEmployeeTypes.filter((i) => i !== id),
                status,
              })
            }
            
            label={`Appointment: ${type.name}`}
          />
        ) : null;
      })}
      {status !== "all" && (
        <Chip
        onRemove={() =>
          updateFilters({
            offices: selectedOffices,
            eligibilities: selectedEligibilities,
            employeeTypes: selectedEmployeeTypes,
            status: "all",
          })
        }
        
          label={status === "Active" ? "Status: Active" : "Status: Inactive"}
        />
      )}
    </div>
  
    {/* Filter Modal */}
    <Modal
      title="Filter Employees"
      description="Select filters to narrow down employees"
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <label className="font-semibold block mb-1">Office</label>
          <MultiSelect
            options={offices}
            selected={selectedOffices}
            onChange={setSelectedOffices}
          />
        </div>
  
        <div>
          <label className="font-semibold block mb-1">Eligibility</label>
          <MultiSelect
            options={eligibilities}
            selected={selectedEligibilities}
            onChange={setSelectedEligibilities}
          />
        </div>
  
        <div>
          <label className="font-semibold block mb-1">Appointment</label>
          <MultiSelect
            options={employeeTypes}
            selected={selectedEmployeeTypes}
            onChange={setSelectedEmployeeTypes}
          />
        </div>
  
        <div>
          <label className="font-semibold block mb-1">Status</label>
          <select
            className="border rounded p-2 w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
  
        <div className="flex flex-col-reverse md:flex-row justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={clearAll}
            className="w-full md:w-auto"
          >
            Clear All
          </Button>
          <Button onClick={handleApply} className="w-full md:w-auto">
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  </>
  
  );
}
