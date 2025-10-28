"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CommandDialog } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

type EmployeeSearchResult = {
  id: string;
  employeeNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  positionTitle?: string;
  employeeType: string;
  employeeTypeColor?: string;
  officeId?: string;
  officeName?: string;
  photoUrl?: string;
};

export type AddPersonDialogSelection = {
  employee: EmployeeSearchResult;
  connectToParent: boolean;
  dropNearCursor: boolean;
  alignToGrid: boolean;
};

type AddPersonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  onSelect: (selection: AddPersonDialogSelection) => void | Promise<void>;
  canConnectToParent: boolean;
  initialConnectToParent: boolean;
  initialDropNearCursor: boolean;
};

type EmployeeSearchResponse = {
  items: EmployeeSearchResult[];
  nextCursor?: string;
};

export function AddPersonDialog({
  open,
  onOpenChange,
  departmentId,
  onSelect,
  canConnectToParent,
  initialConnectToParent,
  initialDropNearCursor,
}: AddPersonDialogProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<EmployeeSearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [connectToParent, setConnectToParent] = useState(initialConnectToParent);
  const [dropNearCursor, setDropNearCursor] = useState(initialDropNearCursor);
  const [alignToGrid, setAlignToGrid] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setNextCursor(undefined);
      setConnectToParent(initialConnectToParent && canConnectToParent);
      setDropNearCursor(initialDropNearCursor);
      setAlignToGrid(true);
      setHasFetched(false);
    }
  }, [open, initialConnectToParent, canConnectToParent, initialDropNearCursor]);

  const fetchResults = useCallback(
    async (search: string, cursor?: string, append = false) => {
      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(
          `/api/${departmentId}/employees/search?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = (await response.json()) as EmployeeSearchResponse;
        setResults((prev) => {
          const next = append ? [...prev, ...data.items] : data.items;
          if (liveRegionRef.current) {
            liveRegionRef.current.textContent = `${next.length} result${next.length === 1 ? "" : "s"}`;
          }
          return next;
        });
        setNextCursor(data.nextCursor);
        setHasFetched(true);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        toast({
          title: "Search failed",
          description: (error as Error).message || "Unable to load employees.",
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

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || isLoading) return;
    fetchResults(debouncedQuery, nextCursor, true);
  }, [debouncedQuery, fetchResults, isLoading, nextCursor]);

  const initialsFor = useCallback((employee: EmployeeSearchResult) => {
    const initials = [employee.firstName?.[0], employee.lastName?.[0]]
      .filter(Boolean)
      .join("");
    return initials || "?";
  }, []);

  const handleSelect = useCallback(
    (employee: EmployeeSearchResult) => {
      onSelect({
        employee,
        connectToParent: connectToParent && canConnectToParent,
        dropNearCursor,
        alignToGrid,
      });
    },
    [alignToGrid, canConnectToParent, connectToParent, dropNearCursor, onSelect]
  );

  const renderFooterToggle = useCallback(
    (id: string, label: string, checked: boolean, onChange: (value: boolean) => void, disabled = false) => (
      <label
        key={id}
        htmlFor={id}
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition",
          disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer hover:border-border"
        )}
      >
        <span className="flex-1 text-left">
          <span className="font-medium text-foreground">{label}</span>
        </span>
        <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </label>
    ),
    []
  );

  const emptyState = useMemo(() => {
    if (!hasFetched && isLoading) {
      return null;
    }
    if (!debouncedQuery && !results.length) {
      return "Type a name or employee number.";
    }
    return "No employees found.";
  }, [debouncedQuery, hasFetched, isLoading, results.length]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-2 p-4 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          <span>Search employees</span>
        </div>
        <Command shouldFilter={false} label="Employee search" className="overflow-hidden rounded-md border">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search by name, employee number, or title"
            aria-label="Search employees"
            autoFocus
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyState}</CommandEmpty>
            <CommandGroup heading="Directory">
              {results.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.id}
                  onSelect={() => handleSelect(employee)}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <Avatar className="h-9 w-9 border">
                    {employee.photoUrl ? <AvatarImage src={employee.photoUrl} alt={employee.firstName} /> : null}
                    <AvatarFallback>{initialsFor(employee)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-foreground">
                      {employee.firstName} {employee.middleName ? `${employee.middleName} ` : ""}
                      {employee.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {employee.employeeNo ? <span className="font-mono">{employee.employeeNo}</span> : null}
                      {employee.positionTitle ? <span className="truncate">{employee.positionTitle}</span> : null}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {employee.officeName || "No office"}
                  </div>
                </CommandItem>
              ))}
              {nextCursor ? (
                <CommandItem value="__load_more__" onSelect={handleLoadMore} disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Load more results</span>
                  )}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
        <div ref={liveRegionRef} className="sr-only" aria-live="polite" />
        {isLoading && !nextCursor ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        ) : null}
      </div>
      <div className="border-t bg-muted/40 p-4">
        <div className="grid gap-2">
          {renderFooterToggle(
            "connect-parent",
            "Connect to selected parent",
            connectToParent && canConnectToParent,
            (value) => setConnectToParent(value),
            !canConnectToParent
          )}
          {renderFooterToggle("drop-cursor", "Drop near cursor", dropNearCursor, setDropNearCursor)}
          {renderFooterToggle("align-grid", "Align to 16px grid", alignToGrid, setAlignToGrid)}
        </div>
      </div>
    </CommandDialog>
  );
}

export type { EmployeeSearchResult };
