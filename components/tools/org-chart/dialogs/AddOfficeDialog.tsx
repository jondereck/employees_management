"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

export type OfficeSearchResult = {
  id: string;
  name: string;
  headEmployeeId?: string;
  employeeCount: number;
};

type AddOfficeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  onSelect: (office: OfficeSearchResult, options: { includePeople: boolean; includeStaffUnit: boolean }) => void | Promise<void>;
};

type OfficeSearchResponse = {
  items: OfficeSearchResult[];
};

export function AddOfficeDialog({ open, onOpenChange, departmentId, onSelect }: AddOfficeDialogProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<OfficeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [includePeople, setIncludePeople] = useState(true);
  const [includeStaffUnit, setIncludeStaffUnit] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setIncludePeople(true);
      setIncludeStaffUnit(true);
    }
  }, [open]);

  const fetchResults = useCallback(
    async (search: string) => {
      try {
        if (abortRef.current) {
          abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setIsLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        const response = await fetch(`/api/${departmentId}/offices/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = (await response.json()) as OfficeSearchResponse;
        setResults(data.items);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        toast({
          title: "Search failed",
          description: (error as Error).message || "Unable to load offices.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [departmentId, toast]
  );

  useEffect(() => {
    if (!open) return;
    fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults, open]);

  const emptyState = useMemo(() => {
    if (!debouncedQuery && !results.length && !isLoading) {
      return "Type an office name to search.";
    }
    if (!results.length && !isLoading) {
      return "No offices found.";
    }
    return null;
  }, [debouncedQuery, isLoading, results.length]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-2 p-4 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          <span>Search offices</span>
        </div>
        <Command shouldFilter={false} className="overflow-hidden rounded-md border">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search by office name"
            aria-label="Search offices"
            autoFocus
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyState ?? "Searching…"}</CommandEmpty>
            <CommandGroup heading="Offices">
              {results.map((office) => (
                <CommandItem
                  key={office.id}
                  value={office.id}
                  onSelect={() => onSelect(office, { includePeople, includeStaffUnit })}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium text-foreground">{office.name}</span>
                    <span className="text-xs text-muted-foreground">{office.employeeCount} employee{office.employeeCount === 1 ? "" : "s"}</span>
                  </div>
                  <Badge variant="secondary">{office.employeeCount}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        ) : null}
      </div>
      <div className="border-t bg-muted/40 p-4">
        <div className="grid gap-2">
          <label
            htmlFor="include-people"
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition",
              "cursor-pointer hover:border-border"
            )}
          >
            <span className="font-medium text-foreground">Include people</span>
            <Switch
              id="include-people"
              checked={includePeople}
              onCheckedChange={(value) => {
                setIncludePeople(value);
                if (!value) {
                  setIncludeStaffUnit(false);
                }
              }}
            />
          </label>
          <label
            htmlFor="include-staff"
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition",
              includePeople ? "cursor-pointer hover:border-border" : "cursor-not-allowed text-muted-foreground"
            )}
          >
            <span className="font-medium text-foreground">Create “Staff” unit</span>
            <Switch
              id="include-staff"
              checked={includeStaffUnit && includePeople}
              disabled={!includePeople}
              onCheckedChange={(value) => setIncludeStaffUnit(value)}
            />
          </label>
        </div>
      </div>
    </CommandDialog>
  );
}
