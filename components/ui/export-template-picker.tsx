// components/TemplatePickerBar.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Trash2, Save, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBuiltInTemplateId } from "@/utils/export-templates";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "./input";

type Template = {
  id: string;
  name: string;
  description?: string;
  selectedKeys: string[];
};

type Props = {
  className?: string;
  value: string | undefined;
  templates: Template[];
  onApply: (tpl: Template) => void;
  onChangeSelected?: (id: string | undefined) => void;
  clearLastUsedTemplate: () => void;
  clearAllUserTemplates: () => void;
  deleteUserTemplate: (id: string) => void;
  refreshTemplates: () => void;
  onRequestOverwrite?: (id: string) => void;
  onRequestRename?: (id: string, newName: string) => void;
  builtinIds?: string[];
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
  onRequestOverwrite,
  onRequestRename,
  builtinIds = ["hr-core", "plantilla", "payroll", "gov-ids"],
}: Props) {
  const selected = useMemo(() => templates.find((tpl) => tpl.id === value), [templates, value]);
  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
      ),
    [templates]
  );
  const isDeletable = selected && !builtinIds.includes(selected.id);
  const isBuiltIn = value ? isBuiltInTemplateId(value) : false;

  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const openRename = () => {
    if (!selected || isBuiltIn) return;
    setNewName(selected.name ?? "");
    setRenameOpen(true);
  };

  const confirmRename = () => {
    if (!value) return;
    const finalName = newName.trim();
    if (!finalName) return;
    onRequestRename?.(value, finalName);
    setRenameOpen(false);
  };

  const handleApplyTemplate = (tpl: Template) => {
    onApply(tpl);
    onChangeSelected?.(tpl.id);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-between">
                {selected ? selected.name : "Choose export template..."}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="w-[280px] max-h-64 overflow-y-auto"
            >
              <DropdownMenuLabel className="sticky top-0 z-10 bg-popover">Templates</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={value}
                onValueChange={(id) => {
                  const tpl = templates.find((t) => t.id === id);
                  if (tpl) {
                    handleApplyTemplate(tpl);
                  }
                }}
              >
                {sortedTemplates.map((tpl) => (
                  <DropdownMenuRadioItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    clearLastUsedTemplate();
                    refreshTemplates();
                  }}
                  aria-label="Clear last used preset"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear last used</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={() => value && !isBuiltIn && onRequestOverwrite?.(value)}
                  disabled={!value || isBuiltIn}
                  className="shrink-0"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!value
                  ? "Select a template first"
                  : isBuiltIn
                  ? "Built-in templates can't be updated"
                  : "Update (overwrite) selected template"}
              </TooltipContent>
            </Tooltip>

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
                      if (onChangeSelected && value === selected.id) onChangeSelected(undefined);
                    }
                  }}
                  aria-label="Delete selected preset"
                  title={isDeletable ? "Delete selected preset" : "Built-in presets cannot be deleted"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isDeletable ? "Delete selected preset" : "Built-in preset"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={openRename}
                  disabled={!value || isBuiltIn}
                  className="shrink-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!value
                  ? "Select a template first"
                  : isBuiltIn
                  ? "Built-in templates can't be renamed"
                  : "Rename template"}
              </TooltipContent>
            </Tooltip>

            {/* Optional â€œclear allâ€ action */}
            {/* <Tooltip>
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
            </Tooltip> */}
          </div>
        </div>
      </TooltipProvider>

      <Dialog modal={false} open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md" style={{ zIndex: 240 }}>
          <DialogHeader>
            <DialogTitle>Rename template</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Template name"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              This updates only the template name. Use the save icon to overwrite its settings.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={!newName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


