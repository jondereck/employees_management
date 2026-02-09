"use client";

import React, { useMemo } from "react";
import { 
  GripVertical, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Info,
  LayoutGrid
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "../ui/action-tooltip";
import { Badge } from "../ui/badge";

// This is the Draggable Row Component (Your logic for individual columns)
const SortableColumnRow = ({ id, name, onRemove }: { id: string; name: string; onRemove: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-2 bg-white border rounded-lg mb-2 shadow-sm transition-all",
        isDragging ? "border-indigo-500 ring-2 ring-indigo-100 shadow-md" : "border-slate-200"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-100 rounded text-slate-400"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      
      <span className="flex-1 text-sm font-medium text-slate-700">{name}</span>

      <ActionTooltip label="Remove from export">
        <button 
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </ActionTooltip>
    </div>
  );
};

export const ColumnManager = ({ state, actions, allColumns }: any) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Logic to handle the end of a drag event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = state.selectedColumns.indexOf(active.id as string);
      const newIndex = state.selectedColumns.indexOf(over.id as string);
      actions.setSelectedColumns(arrayMove(state.selectedColumns, oldIndex, newIndex));
    }
  };

  // Organize available columns into categories (Group logic)
  const availableColumns = allColumns.filter(
    (col: any) => !state.selectedColumns.includes(col.key)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* LEFT: Available Columns Library */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-slate-400" />
            Column Library
          </h3>
          <Badge variant="outline">{availableColumns.length} Hidden</Badge>
        </div>
        
        <div className="border rounded-xl p-4 bg-slate-50/50 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
          <div className="grid grid-cols-1 gap-2">
            {availableColumns.map((col: any) => (
              <button
                key={col.key}
                onClick={() => actions.setSelectedColumns([...state.selectedColumns, col.key])}
                className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-left text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all group"
              >
                <span className="truncate font-medium">{col.name}</span>
                <Plus className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Export Sequence (Active Columns) */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
            Active Export Sequence
          </h3>
          <span className="text-[10px] text-slate-400 italic">Drag to reorder columns</span>
        </div>

        <div className="border rounded-xl p-4 bg-white flex-1 overflow-y-auto max-h-[500px] custom-scrollbar shadow-inner">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={state.selectedColumns} strategy={verticalListSortingStrategy}>
              {state.selectedColumns.map((colKey: string) => {
                const columnDef = allColumns.find((c: any) => c.key === colKey);
                return (
                  <SortableColumnRow
                    key={colKey}
                    id={colKey}
                    name={columnDef?.name || colKey}
                    onRemove={() => actions.setSelectedColumns(
                      state.selectedColumns.filter((k: string) => k !== colKey)
                    )}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
          
          {state.selectedColumns.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-20">
              <Info className="h-8 w-8 opacity-20" />
              <p className="text-sm">No columns selected for export</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};