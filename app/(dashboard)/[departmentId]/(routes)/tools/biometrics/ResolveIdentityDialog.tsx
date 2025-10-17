"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";

export type ResolveSearchResult = {
  id: string;
  name: string;
  employeeNo?: string | null;
  officeId?: string | null;
  officeName?: string | null;
};

type ResolveIdentityDialogProps = {
  open: boolean;
  token: string | null;
  name: string | null;
  busy: boolean;
  onClose: () => void;
  onResolve: (result: ResolveSearchResult) => Promise<void> | void;
};

const EMPTY_RESULTS: ResolveSearchResult[] = [];

const normalizeResult = (value: ResolveSearchResult): ResolveSearchResult => ({
  ...value,
  employeeNo: value.employeeNo ?? null,
  officeId: value.officeId ?? null,
  officeName: value.officeName ?? null,
});

const fetchEmployees = async (query: string, signal?: AbortSignal) => {
  const url = new URL("/api/biometrics/search", window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Search failed");
  }
  const payload = (await response.json()) as { results?: ResolveSearchResult[] };
  return (payload.results ?? EMPTY_RESULTS).map(normalizeResult);
};

const highlight = (text: string, query: string) => {
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return (
    <span>
      {before}
      <span className="font-semibold text-primary">{match}</span>
      {after}
    </span>
  );
};

const officeLabel = (value: ResolveSearchResult) =>
  value.officeName?.trim() || "(Unassigned)";

export default function ResolveIdentityDialog({
  open,
  token,
  name,
  busy,
  onClose,
  onResolve,
}: ResolveIdentityDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [results, setResults] = useState<ResolveSearchResult[]>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearchTerm("");
    setResults(EMPTY_RESULTS);
    setSearchError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = debouncedSearch.trim();
    if (!query) {
      setResults(EMPTY_RESULTS);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setSearchError(null);

    fetchEmployees(query, controller.signal)
      .then((payload) => {
        setResults(payload);
        setIsSearching(false);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Employee search failed", error);
        setSearchError(error instanceof Error ? error.message : "Unable to search employees.");
        setIsSearching(false);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearch, open]);

  const handleResolve = useCallback(
    async (result: ResolveSearchResult) => {
      await onResolve(result);
    },
    [onResolve]
  );

  const placeholder = useMemo(() => {
    if (!token) return "";
    return `Search for a name or employee no.`;
  }, [token]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!busy && !next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Resolve biometrics token</DialogTitle>
          <DialogDescription>
            {token ? (
              <span>
                Link <span className="font-mono font-semibold">{token}</span> to an employee record.
              </span>
            ) : (
              "Select an employee to map this token."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            <p>
              <span className="font-semibold">Token:</span> {token ?? "—"}
            </p>
            <p>
              <span className="font-semibold">Name from logs:</span> {name ?? "(Unmatched)"}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Search employees</label>
            <Command shouldFilter={false} className="rounded-lg border">
              <CommandInput
                value={searchTerm}
                onValueChange={setSearchTerm}
                placeholder={placeholder}
                disabled={busy}
                aria-label="Search employees"
              />
              <CommandList>
                {results.length === 0 ? (
                  <CommandEmpty>
                    {isSearching ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                      </div>
                    ) : searchError ? (
                      <div className="py-3 text-sm text-destructive">{searchError}</div>
                    ) : debouncedSearch.trim() ? (
                      <div className="py-3 text-sm text-muted-foreground">No employees found.</div>
                    ) : (
                      <div className="py-3 text-sm text-muted-foreground">
                        Start typing to search employees.
                      </div>
                    )}
                  </CommandEmpty>
                ) : null}
                {results.length > 0 ? (
                  <CommandGroup>
                    {results.map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => void handleResolve(result)}
                        disabled={busy}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {highlight(result.name, debouncedSearch.trim())}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {result.employeeNo ? `#${result.employeeNo} · ` : ""}
                            {officeLabel(result)}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Create later
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Select a record above to link this token.
            </span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
