"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OfficeFilterOption = {
  key: string;
  label: string;
  count: number;
};

export type OfficeFilterControlProps = {
  options: OfficeFilterOption[];
  selected: string[];
  onToggle: (key: string, checked: boolean) => void;
  onClear: () => void;
  applyToExport: boolean;
  onApplyToExportChange: (next: boolean) => void;
};

const useIsMobile = (query = "(max-width: 640px)") => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => setIsMobile(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return isMobile;
};

const OfficeFilterControl = ({
  options,
  selected,
  onToggle,
  onClear,
  applyToExport,
  onApplyToExportChange,
}: OfficeFilterControlProps) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleSelection = useCallback(
    (key: string) => {
      onToggle(key, !selectedSet.has(key));
    },
    [onToggle, selectedSet]
  );

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  const triggerLabel = selected.length ? `Office (${selected.length})` : "Office";

  const content = (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-between pb-3">
        <div>
          <p className="text-sm font-semibold">Filter by office</p>
          <p className="text-xs text-muted-foreground">
            Showing {selected.length ? `${selected.length} selected` : "all"} offices
          </p>
        </div>
        {selected.length ? (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
        ) : null}
      </div>
      <Command shouldFilter>
        <CommandInput placeholder="Search offices…" aria-label="Search offices" />
        <CommandList className="max-h-64">
          <CommandEmpty>No offices found.</CommandEmpty>
          <CommandGroup heading="Offices">
            {options.map((option) => {
              const checked = selectedSet.has(option.key);
              return (
                <CommandItem
                  key={option.key}
                  onSelect={() => toggleSelection(option.key)}
                  className="flex items-center justify-between gap-3 px-2 py-2 text-sm"
                  aria-selected={checked}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background"
                      )}
                    >
                      {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                    </span>
                    <span>{option.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{option.count.toLocaleString()}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="mt-3 border-t pt-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={applyToExport}
            onCheckedChange={(checked) => onApplyToExportChange(Boolean(checked))}
            disabled={!selected.length}
          />
          Apply to download
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          When disabled, exports include all offices but the on-screen filter stays active.
        </p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2"
        >
          <Building2 className="h-4 w-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <div className="p-4">{content}</div>
        </CommandDialog>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="inline-flex items-center gap-2">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-4">
        {content}
      </PopoverContent>
    </Popover>
  );
};

export default OfficeFilterControl;
