"use client";

import React from "react";
import { ArrowUpDown, SortAsc, SortDesc, Trash2, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { SORT_FIELDS } from "@/utils/sort-fields";
import { cn } from "@/lib/utils";

export const SortSection = ({ state, actions }: any) => {
  const addLevel = () => {
    if (state.sortLevels.length < 3) {
      actions.updateSort(state.sortLevels.length, "updatedAt", "desc");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Sort Hierarchy</h3>
          <p className="text-xs text-slate-500">Define up to 3 levels of data sorting</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={addLevel}
          disabled={state.sortLevels.length >= 3}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Add Level
        </Button>
      </div>

      <div className="space-y-3">
        {state.sortLevels.map((level: any, index: number) => (
          <div 
            key={index} 
            className="flex items-center gap-3 p-4 bg-white border rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 shrink-0">
              {index + 1}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4">
              <Select 
                value={level.field} 
                onValueChange={(val) => actions.updateSort(index, val, level.dir)}
              >
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select Field" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_FIELDS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label as unknown as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => actions.updateSort(index, level.field, 'asc')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    level.dir === 'asc' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"
                  )}
                >
                  <SortAsc className="h-3 w-3" /> Ascending
                </button>
                <button
                  onClick={() => actions.updateSort(index, level.field, 'desc')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    level.dir === 'desc' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"
                  )}
                >
                  <SortDesc className="h-3 w-3" /> Descending
                </button>
              </div>
            </div>

            {index > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => actions.removeSortLevel(index)}
                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};