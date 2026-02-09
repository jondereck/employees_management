"use client";

import React, { useMemo, useState } from "react";
import { 
  Building2, 
  Fingerprint, 
  Search, 
  CheckSquare, 
  Square, 
  Info 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Types from your original logic
type OfficeOption = { id: string; name: string; bioIndexCode?: string | null };

export const FilterSection = ({ state, actions, officeOptions }: any) => {
  const [search, setSearch] = useState("");

  // 1. Logic for "Bio Index" grouping
  const bioIndexGroups = useMemo(() => {
    const groups: Record<string, { code: string; ids: string[]; names: string[] }> = {};
    
    officeOptions.forEach((off: OfficeOption) => {
      const code = off.bioIndexCode || "NO_CODE";
      if (!groups[code]) {
        groups[code] = { code, ids: [], names: [] };
      }
      groups[code].ids.push(off.id);
      groups[code].names.push(off.name);
    });
    
    return Object.values(groups);
  }, [officeOptions]);

  // 2. Filtering based on search input
  const filteredOffices = officeOptions.filter((off: OfficeOption) => 
    off.name.toLowerCase().includes(search.toLowerCase()) ||
    off.bioIndexCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Selection Mode & Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-slate-50 p-4 rounded-xl border">
        <div className="space-y-2 flex-1 w-full">
          <label className="text-sm font-semibold text-slate-700">Group Selection By:</label>
          <div className="flex p-1 bg-slate-200 rounded-lg w-fit">
            <button
              onClick={() => actions.setFilterGroupMode('office')}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                state.filterGroupMode === 'office' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"
              )}
            >
              Individual Offices
            </button>
            <button
              onClick={() => actions.setFilterGroupMode('bioIndex')}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                state.filterGroupMode === 'bioIndex' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"
              )}
            >
              Bio Index Codes
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search offices or codes..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Select All / Deselect Toolbar */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => actions.selectAllOffices(filteredOffices)}>
          <CheckSquare className="h-4 w-4 mr-2" /> Select Filtered
        </Button>
        <Button variant="ghost" size="sm" onClick={() => actions.setSelectedOffices([])}>
          <Square className="h-4 w-4 mr-2" /> Clear All
        </Button>
        <div className="ml-auto text-xs text-slate-500">
          Selected: <span className="font-bold text-indigo-600">{state.selectedOffices.length}</span>
        </div>
      </div>

      {/* The Scrollable Selection Grid */}
      <div className="border rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 max-h-[400px] overflow-y-auto custom-scrollbar">
          {state.filterGroupMode === 'office' ? (
            filteredOffices.map((off: OfficeOption) => {
              const isSelected = state.selectedOffices.includes(off.id);
              return (
                <button
                  key={off.id}
                  onClick={() => actions.toggleOffice(off.id)}
                  className={cn(
                    "flex items-start gap-3 p-4 text-left transition-colors bg-white hover:bg-slate-50",
                    isSelected && "bg-indigo-50/50"
                  )}
                >
                  <div className={cn(
                    "mt-1 h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"
                  )}>
                    {isSelected && <CheckSquare className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium truncate", isSelected ? "text-indigo-900" : "text-slate-700")}>
                      {off.name}
                    </p>
                    {off.bioIndexCode && (
                      <Badge variant="secondary" className="mt-1 text-[10px] font-mono">
                        {off.bioIndexCode}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            bioIndexGroups.map((group) => {
              const allInGroup = group.ids.every(id => state.selectedOffices.includes(id));
              return (
                <button
                  key={group.code}
                  onClick={() => actions.toggleBioGroup(group.ids)}
                  className={cn(
                    "flex flex-col p-4 text-left transition-colors bg-white hover:bg-slate-50 border-r",
                    allInGroup && "bg-indigo-50/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Fingerprint className={cn("h-4 w-4", allInGroup ? "text-indigo-600" : "text-slate-400")} />
                      <span className="text-sm font-bold">{group.code}</span>
                    </div>
                    <Badge variant="outline">{group.ids.length} offices</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2">
                    {group.names.join(", ")}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};