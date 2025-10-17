"use client";

import React, { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  SUMMARY_COLUMN_DEFINITION_MAP,
  SUMMARY_COLUMN_GROUP_LABEL,
  type SummaryColumnDefinition,
  type SummaryColumnKey,
} from "@/utils/biometricsExportConfig";

export type SummaryColumnSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnOrder: SummaryColumnKey[];
  selectedColumns: SummaryColumnKey[];
  onToggleColumn: (key: SummaryColumnKey, checked: boolean) => void;
  onReorderColumns: (order: SummaryColumnKey[]) => void;
  onSelectAll: () => void;
  onResetDefault: () => void;
  minSelected?: number;
};

type SortableColumnItemProps = {
  definition: SummaryColumnDefinition;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const SortableColumnItem = ({ definition, checked, disabled, onCheckedChange }: SortableColumnItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: definition.key,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-3 border-b bg-background px-3 py-3 text-sm",
        isDragging ? "shadow-lg" : "",
        disabled ? "opacity-70" : ""
      )}
    >
      <div className="flex flex-1 items-start gap-3">
        <button
          type="button"
          className="mt-1 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded border border-dashed"
          aria-label={`Drag ${definition.label} to reorder`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{definition.label}</span>
            <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {SUMMARY_COLUMN_GROUP_LABEL[definition.groupId]}
            </span>
          </div>
          {definition.description ? (
            <p className="text-xs text-muted-foreground">{definition.description}</p>
          ) : null}
        </div>
      </div>
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        disabled={disabled}
        aria-label={`Toggle ${definition.label}`}
      />
    </div>
  );
};

const SummaryColumnSelector = ({
  open,
  onOpenChange,
  columnOrder,
  selectedColumns,
  onToggleColumn,
  onReorderColumns,
  onSelectAll,
  onResetDefault,
  minSelected = 1,
}: SummaryColumnSelectorProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const selectedSet = useMemo(() => new Set(selectedColumns), [selectedColumns]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIndex = columnOrder.indexOf(active.id as SummaryColumnKey);
    const overIndex = columnOrder.indexOf(over.id as SummaryColumnKey);
    if (activeIndex === -1 || overIndex === -1) return;
    const nextOrder = arrayMove(columnOrder, activeIndex, overIndex);
    onReorderColumns(nextOrder);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose columns for Excel export</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onSelectAll}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={onResetDefault}>
                Reset to default
              </Button>
            </div>
            <Button variant="ghost" size="sm" disabled>
              Save preset…
            </Button>
          </div>
          <div className="max-h-[360px] overflow-y-auto rounded-md border">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
                {columnOrder.map((key) => {
                  const definition = SUMMARY_COLUMN_DEFINITION_MAP[key];
                  const checked = selectedSet.has(key);
                  const disabled = checked && selectedSet.size <= minSelected;
                  return (
                    <SortableColumnItem
                      key={key}
                      definition={definition}
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(next) => onToggleColumn(key, next)}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-xs text-muted-foreground">
            Drag to reorder. At least {minSelected} column{minSelected === 1 ? "" : "s"} required.
          </span>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SummaryColumnSelector;
