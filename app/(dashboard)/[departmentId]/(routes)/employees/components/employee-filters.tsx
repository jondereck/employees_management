"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import Chip from "./chip";

interface Option {
  id: string;
  name: string;
}

const STATUS_VALUES = ["all", "Active", "Inactive"] as const;
type StatusValue = typeof STATUS_VALUES[number];


interface EmployeeFiltersProps {
  offices: Option[];
  eligibilities: Option[];
  employeeTypes: Option[];
  positions: Option[]; // <-- Option[]
  onFilterChange: (filters: {
    offices: string[];
    eligibilities: string[];
    employeeTypes: string[];
    positions: string[];         // <-- included
    status: StatusValue;
  }) => void;
}

export default function EmployeeFilters({
  offices,
  eligibilities,
  employeeTypes,
  positions,
  onFilterChange,
  
}: EmployeeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedEligibilities, setSelectedEligibilities] = useState<string[]>([]);
  const [selectedEmployeeTypes, setSelectedEmployeeTypes] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
 const [status, setStatus] = useState<StatusValue>("all");


   const handleApply = () => {
    onFilterChange({
      offices: selectedOffices,
      eligibilities: selectedEligibilities,
      employeeTypes: selectedEmployeeTypes,
      positions: selectedPositions, // NEW
      status,
    });
    setIsOpen(false);
  };


  const updateFilters = ({
    offices,
    eligibilities,
    employeeTypes,
    positions,
    status,
  }: {
    offices: string[];
    eligibilities: string[];
    employeeTypes: string[];
    positions: string[]; // NEW
    status: StatusValue;
  }) => {
    setSelectedOffices(offices);
    setSelectedEligibilities(eligibilities);
    setSelectedEmployeeTypes(employeeTypes);
    setSelectedPositions(positions); // NEW
    setStatus(status);
    onFilterChange({ offices, eligibilities, employeeTypes, positions, status });
  };

  const clearAll = () => {
    updateFilters({
      offices: [],
      eligibilities: [],
      employeeTypes: [],
      positions: [], // NEW
      status: "all",
    });
    setIsOpen(false);
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
      {/* Inline Filter button - visible on md+ */}
      <Button
        onClick={() => setIsOpen(true)}
        id="open-filters"
        className="hidden md:inline-block md:w-auto w-full"
      >
        Filter
      </Button>

      {/* Floating Filter button - visible on small screens */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-lg px-4 py-3"
        >
          Filter
        </Button>
      </div>

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
                  positions: selectedPositions, // NEW
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
                  positions: selectedPositions, // NEW
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
                  positions: selectedPositions, // NEW
                  status,
                })
              }
              label={`Appointment: ${type.name}`}
            />
          ) : null;
        })}

        {selectedPositions.map((id) => {
          const pos = positions.find((p) => p.id === id);
          return pos ? (
            <Chip
              key={id}
              onRemove={() =>
                updateFilters({
                  offices: selectedOffices,
                  eligibilities: selectedEligibilities,
                  employeeTypes: selectedEmployeeTypes,
                  positions: selectedPositions.filter((i) => i !== id), // NEW
                  status,
                })
              }
              label={`Position: ${pos.name}`}
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
                positions: selectedPositions, // NEW
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
            <label className="font-semibold block mb-1">Position</label>
            <MultiSelect
              options={positions}
              selected={selectedPositions}
              onChange={setSelectedPositions}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Status</label>
            <select
              className="border rounded p-2 w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusValue)}
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
