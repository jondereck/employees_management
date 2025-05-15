// AdvancedFilterPanel.tsx
import React, { useState } from "react";

interface FilterProps {
  onApply: (filters: any) => void;
  onReset: () => void;
  positions: string[];
  offices: string[];
  eligibilities: string[];
}

export default function AdvancedFilterPanel({ onApply, onReset, positions, offices, eligibilities }: FilterProps) {
  const [searchName, setSearchName] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterOffice, setFilterOffice] = useState("");
  const [filterEligibility, setFilterEligibility] = useState("");
  // other filters...

  const handleApply = () => {
    onApply({
      searchName,
      filterPosition,
      filterOffice,
      filterEligibility,
      // add others
    });
  };

  const handleReset = () => {
    setSearchName("");
    setFilterPosition("");
    setFilterOffice("");
    setFilterEligibility("");
    // reset others
    onReset();
  };

  return (
    <div className="filter-panel">
      {/* inputs/selects for each filter */}
      <input
        type="text"
        placeholder="Search Name"
        value={searchName}
        onChange={e => setSearchName(e.target.value)}
      />
      {/* select inputs */}
      <select value={filterPosition} onChange={e => setFilterPosition(e.target.value)}>
        <option value="">All Positions</option>
        {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
      </select>
      {/* similarly for office, eligibility */}

      <button onClick={handleApply}>Apply Filters</button>
      <button onClick={handleReset}>Reset Filters</button>
    </div>
  );
}
