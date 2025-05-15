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
    setSelectedOffices([]);
    setSelectedEligibilities([]);
    setSelectedEmployeeTypes([]);
    setStatus("all");
  };

  // Simple multi-select implementation using checkboxes
  // Replace with your own MultiSelect UI if you want
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
      <Button onClick={() => setIsOpen(true)}>Filter</Button>

      {/* Show active filters as chips */}
      <div className="flex gap-2 mt-2 flex-wrap">
        {selectedOffices.map((id) => {
          const office = offices.find((o) => o.id === id);
          return office ? (
            <Chip
              key={id}
              onRemove={() =>
                setSelectedOffices(selectedOffices.filter((i) => i !== id))
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
                setSelectedEligibilities(selectedEligibilities.filter((i) => i !== id))
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
                setSelectedEmployeeTypes(selectedEmployeeTypes.filter((i) => i !== id))
              }
              label={`Appointment: ${type.name}`}
            />
          ) : null;
        })}
        {status !== "all" && (
          <Chip
            onRemove={() => setStatus("all")}
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
        <div className="space-y-4">
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={clearAll}>
              Clear All
            </Button>
            <Button onClick={handleApply}>Apply</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
