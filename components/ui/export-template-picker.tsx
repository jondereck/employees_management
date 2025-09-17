// components/TemplatePickerBar.tsx
"use client";

import { useMemo } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FaBroom } from "react-icons/fa";

type Template = {
  id: string;            // e.g. "hr-core" | "plantilla" | "payroll" | "gov-ids" or user ids
  name: string;
  description?: string;
  selectedKeys: string[];
  // ...whatever else you store
};

type Props = {
  className?: string;
  value: string | undefined;                 // selected template id
  templates: Template[];
  onApply: (tpl: Template) => void;          // called when user picks a template
  onChangeSelected?: (id: string | undefined) => void;
  // actions wired to your storage helpers
  clearLastUsedTemplate: () => void;
  clearAllUserTemplates: () => void;
  deleteUserTemplate: (id: string) => void;
  refreshTemplates: () => void;

  /** Optional list of core/built-in ids that must NOT be deletable */
  builtinIds?: string[]; // default: ["hr-core", "plantilla", "payroll", "gov-ids"]
};

export default function TemplatePickerBar({
  className,
  value,
  templates,
  onApply,
  onChangeSelected,
  clearLastUsedTemplate,
  clearAllUserTemplates,
  deleteUserTemplate,
  refreshTemplates,
  builtinIds = ["hr-core", "plantilla", "payroll", "gov-ids"],
}: Props) {
  const selected = useMemo(
    () => templates.find(t => t.id === value),
    [templates, value]
  );

  const isDeletable = selected && !builtinIds.includes(selected.id);

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Dropdown */}
        <Select
          value={value}
          onValueChange={(id) => {
            const tpl = templates.find(t => t.id === id);
            if (tpl) {
              onApply(tpl);
              onChangeSelected?.(tpl.id);
            }
          }}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Choose export template…" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Actions to the right of the dropdown */}
        <div className="flex items-center gap-1">
          {/* Clear last used */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  clearLastUsedTemplate();
                }}
                aria-label="Clear last used"
                title="Clear last used"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear last used</TooltipContent>
          </Tooltip>

          {/* Delete selected (only for user presets) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={!isDeletable}
                onClick={() => {
                  if (!selected) return;
                  if (builtinIds.includes(selected.id)) return;
                  if (confirm(`Delete preset "${selected.name}"?`)) {
                    deleteUserTemplate(selected.id);
                    refreshTemplates();
                    // if the deleted one was selected, clear selection
                    if (onChangeSelected && value === selected.id) onChangeSelected(undefined);
                  }
                }}
                aria-label="Delete selected preset"
                title={isDeletable ? "Delete selected preset" : "Built-in presets cannot be deleted"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isDeletable ? "Delete selected preset" : "Built-in preset"}
            </TooltipContent>
          </Tooltip>

          {/* Clear ALL user presets */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  if (confirm("Delete all saved (user) presets?")) {
                    clearAllUserTemplates();
                    refreshTemplates();
                  }
                }}
                aria-label="Clear all presets"
                title="Clear all presets"
              >
                <FaBroom className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all presets</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
