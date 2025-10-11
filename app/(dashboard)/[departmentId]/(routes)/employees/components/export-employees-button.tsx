"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import Modal from "@/components/ui/modal";
import { useExportEmployees } from "@/hooks/use-export-employees";
import { employeeExportColumns } from "./export-columns";
import { EmployeeWithRelations } from "@/lib/types";
import { ExportOfficeOption } from "@/utils/download-excel";

interface ExportEmployeesButtonProps {
  departmentId: string;
  offices: ExportOfficeOption[];
  employees?: EmployeeWithRelations[];
}

const badgeClassName = "text-xs font-medium";

export function ExportEmployeesButton({ departmentId, offices, employees }: ExportEmployeesButtonProps) {
  const [officePopoverOpen, setOfficePopoverOpen] = useState(false);

  const {
    isOpen,
    openModal,
    closeModal,
    selectedOfficeIds,
    selectedOfficeItems,
    isOfficeSelected,
    toggleOffice,
    selectAllOffices,
    selectionSummary,
    columnGroups,
    toggleColumn,
    selectAllColumns,
    clearAllColumns,
    selectedColumnCount,
    totalColumnCount,
    isExportDisabled,
    exportDisabledReason,
    exportEmployees,
    isExporting,
    perOfficeSheets,
    setPerOfficeSheets,
    canToggleSheetMode,
    effectiveMode,
  } = useExportEmployees({
    departmentId,
    offices,
    employees,
    columns: employeeExportColumns,
  });

  const selectionBadges = useMemo(() => {
    if (selectedOfficeIds.length === offices.length) {
      return ["All offices"];
    }
    const names = selectedOfficeItems.map((item) => item.name);
    return names;
  }, [selectedOfficeIds.length, offices.length, selectedOfficeItems]);

  const previewBadges = selectionBadges.slice(0, 3);
  const extraCount = selectionBadges.length - previewBadges.length;

  const renderExportButton = () => {
    const button = (
      <Button
        onClick={exportEmployees}
        disabled={isExportDisabled}
        className="min-w-[120px]"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting…
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" /> Export
          </>
        )}
      </Button>
    );

    if (!exportDisabledReason || isExporting) {
      return button;
    }

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{button}</span>
          </TooltipTrigger>
          <TooltipContent>{exportDisabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <Button variant="outline" onClick={openModal} className="flex items-center gap-2">
        <Download className="h-4 w-4" /> Export
      </Button>

      <Modal
        title="Export employees"
        description="Choose offices and columns to include in the Excel export."
        isOpen={isOpen}
        onClose={closeModal}
      >
        <div className="space-y-6 py-4">
          <section className="space-y-2">
            <div>
              <p className="text-sm font-medium">Offices</p>
              <p className="text-sm text-muted-foreground">
                Select one or more offices to include. Choose “All offices” to export every location.
              </p>
            </div>
            <Popover open={officePopoverOpen} onOpenChange={setOfficePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={officePopoverOpen}
                  className="w-full justify-between"
                >
                  <span className="truncate text-left">
                    {selectionSummary}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0">
                <Command>
                  <CommandInput placeholder="Search offices…" />
                  <CommandList>
                    <CommandEmpty>No office found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all__"
                        onSelect={() => {
                          selectAllOffices();
                          setOfficePopoverOpen(true);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${selectedOfficeIds.length === offices.length ? "opacity-100" : "opacity-0"}`}
                        />
                        All offices
                      </CommandItem>
                      {offices.map((office) => {
                        const checked = isOfficeSelected(office.id);
                        return (
                          <CommandItem
                            key={office.id}
                            value={office.name}
                            onSelect={() => {
                              toggleOffice(office.id);
                              setOfficePopoverOpen(true);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${checked ? "opacity-100" : "opacity-0"}`} />
                            <span className="flex flex-col">
                              <span>{office.name}</span>
                              {office.bioIndexCode ? (
                                <span className="text-xs text-muted-foreground">{office.bioIndexCode}</span>
                              ) : null}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex flex-wrap gap-2 pt-1">
              {previewBadges.map((label) => (
                <Badge key={label} variant="secondary" className={badgeClassName}>
                  {label}
                </Badge>
              ))}
              {extraCount > 0 ? (
                <Badge variant="outline" className={badgeClassName}>
                  +{extraCount} more
                </Badge>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Columns</p>
                <p className="text-sm text-muted-foreground">
                  Include or exclude columns for this export.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearAllColumns}>
                  Clear
                </Button>
                <Button variant="ghost" size="sm" onClick={selectAllColumns}>
                  Select all
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {columnGroups.map((group) => (
                <div key={group.name} className="rounded-lg border p-4">
                  <p className="mb-3 text-sm font-semibold">{group.name}</p>
                  <div className="space-y-2">
                    {group.columns.map((column) => (
                      <label key={column.key} className="flex items-center space-x-2 text-sm">
                        <Checkbox
                          checked={column.checked}
                          onCheckedChange={() => toggleColumn(column.key)}
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedColumnCount} of {totalColumnCount} columns selected.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">One sheet per office</p>
                <p className="text-sm text-muted-foreground">
                  {canToggleSheetMode
                    ? "Create a worksheet for each office. Turn off to combine into a single sheet."
                    : "A single worksheet will be created for the selected office."}
                </p>
              </div>
              <Switch
                checked={perOfficeSheets && canToggleSheetMode}
                onCheckedChange={(checked) => setPerOfficeSheets(Boolean(checked))}
                disabled={!canToggleSheetMode}
                aria-label="Toggle per-office sheets"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mode: {effectiveMode === "perOffice" ? "Multiple sheets" : "Single sheet"}
            </p>
          </section>

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={closeModal} disabled={isExporting}>
              Cancel
            </Button>
            {renderExportButton()}
          </div>
        </div>
      </Modal>
    </>
  );
}

export default ExportEmployeesButton;
