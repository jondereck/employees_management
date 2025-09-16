"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, X, Loader2 } from "lucide-react";

type FormatMode = "none" | "upper" | "lower" | "title" | "sentence" | "numeric" | "alphanumeric";
const ALL_MODES: FormatMode[] = ["none", "upper", "lower", "title", "sentence", "numeric", "alphanumeric"];


// --- NEW helpers ---

// --- format helpers ---
function toTitleCase(s: string) {
  return s.toLowerCase().split(/\s+/).map(w => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ");
}
function toSentenceCase(s: string) {
  const t = s.trim();
  if (!t) return t;
  const lower = t.toLowerCase();
  return lower[0].toUpperCase() + lower.slice(1);
}
function onlyDigits(s: string) { return s.replace(/\D+/g, ""); }
function onlyAlnumSpace(s: string) { return s.replace(/[^a-z0-9 ]/gi, ""); }
function applyFormat(val: string, mode: FormatMode): string {
  switch (mode) {
    case "upper": return val.toUpperCase();
    case "lower": return val.toLowerCase();
    case "title": return toTitleCase(val);
    case "sentence": return toSentenceCase(val);
    case "numeric": return onlyDigits(val);
    case "alphanumeric": return onlyAlnumSpace(val);
    default: return val;
  }
}

function softApplyFormat(val: string, mode: FormatMode): string {
  switch (mode) {
    case "upper": return val.toUpperCase();
    case "lower": return val.toLowerCase();
    // for title/sentence while typing, don’t kill spaces:
    case "title": return val
      .split(/(\s+)/) // keep separators
      .map(w => /\s+/.test(w) ? w : (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join("");
    case "sentence":
      if (!val) return val;
      return val[0].toUpperCase() + val.slice(1); // no trim/lower rest while typing
    case "numeric": return onlyDigits(val);
    case "alphanumeric": return onlyAlnumSpace(val); // keeps spaces
    default: return val;
  }
}

function normalizeSpaces(s: string) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function dedupeNormalized(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const clean = normalizeSpaces(x);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}



interface AutoFillDatalistFieldProps {
  label: string;
  field: { value?: string; onChange: (v: string) => void };
  endpoint?: string;
  staticOptions?: string[];
  placeholder?: string;
  showFormatSwitch?: boolean;
  formatMode?: FormatMode;
  formatModes?: FormatMode[];
  disabled?: boolean;

  /** QoL */
  description?: string;
  required?: boolean;
  maxLength?: number;
  showCounter?: boolean;
  className?: string;

  /** Pinned / Popular */
  priorityOptions?: string[];
  pinSuggestions?: boolean;
  pinnedLabel?: string;

  /** NEW: fetch popular from API */
  priorityEndpoint?: string; // e.g. `/api/autofill/popular?field=position&limit=8`
  priorityParams?: Record<string, string | number>; // optional query params to append
}
export function AutoFillDatalistField({
  label,
  field,
  endpoint,
  staticOptions,
  placeholder = "Search or enter...",
  showFormatSwitch = false,
  formatMode = "none",
  formatModes = ALL_MODES,
  disabled,
  description,
  required,
  maxLength,
  showCounter,
  className,
  priorityOptions = [],
  pinSuggestions = false,
  pinnedLabel = "Suggestions",

  // NEW
  priorityEndpoint,
  priorityParams,
}: AutoFillDatalistFieldProps) {
  const [baseOptions, setBaseOptions] = useState<string[]>([]);
  const [fetchedPriority, setFetchedPriority] = useState<string[]>([]);
  const [mode, setMode] = useState<FormatMode>(formatMode);
  const [loading, setLoading] = useState(false);
  const [loadingPriority, setLoadingPriority] = useState(false);
  const listId = useId();
  const [rawValue, setRawValue] = useState<string>(field.value ?? "");
  useEffect(() => {
    setRawValue(field.value ?? "");
  }, [field.value]);

  // commit helper (normalize + hard format)
  function commit(v: string) {
    const committed = applyFormat(normalizeSpaces(v), mode);
    field.onChange(committed);
    setRawValue(committed); // reflect committed value in the input
  }



  useEffect(() => setMode(formatMode), [formatMode]);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!priorityEndpoint) {
        setFetchedPriority([]);
        return;
      }
      setLoadingPriority(true);
      try {
        const url = new URL(priorityEndpoint, window.location.origin);
        if (priorityParams) {
          Object.entries(priorityParams).forEach(([k, v]) => url.searchParams.set(k, String(v)));
        }
        const r = await fetch(url.toString());
        const data = (await r.json()) as unknown;
        const arr = Array.isArray(data) ? data : [];
        if (alive) setFetchedPriority(dedupeNormalized(arr));
      } catch {
        if (alive) setFetchedPriority([]);
      } finally {
        if (alive) setLoadingPriority(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [priorityEndpoint, JSON.stringify(priorityParams)]);

  useEffect(() => {
    let alive = true;
    const priorityUnique = dedupeNormalized([
      ...fetchedPriority,
      ...priorityOptions,
    ]);
    const useStatic = !!(staticOptions && staticOptions.length > 0);

    if (useStatic) {
      const staticUnique = dedupeNormalized(staticOptions!);
      const merged = dedupeNormalized([...priorityUnique, ...staticUnique]);
      setBaseOptions(merged);
      return () => { alive = false; };
    }

    if (!endpoint) {
      setBaseOptions(dedupeNormalized(priorityUnique));
      return () => { alive = false; };
    }

    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const fetched = Array.isArray(data) ? data : [];
        const fetchedUnique = dedupeNormalized(fetched);
        const merged = dedupeNormalized([...priorityUnique, ...fetchedUnique]);
        setBaseOptions(merged);
      })
      .catch(() => {
        if (alive) setBaseOptions(dedupeNormalized(priorityUnique));
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [endpoint, staticOptions, priorityOptions, fetchedPriority]);

  const value = applyFormat(normalizeSpaces(field.value ?? ""), mode);
  const inputMode = mode === "numeric" ? "numeric" : undefined;

  // Build formatted options; keep *order* with priority at top; dedupe on formatted view
  const formattedOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { raw: string; view: string }[] = [];
    for (const raw of baseOptions) {
      const cleanRaw = normalizeSpaces(raw);
      const view = applyFormat(cleanRaw, mode);
      const key = view.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ raw: cleanRaw, view });
      }
    }
    return out;
  }, [baseOptions, mode]);
  const displayValue = softApplyFormat(rawValue, mode);


  // datalist should compare against committed value (optional); using displayValue is fine too:
  const valueLower = displayValue.toLowerCase();
  const datalistOptions = useMemo(() => {
    return formattedOptions.filter(o => o.view.toLowerCase() !== valueLower);
  }, [formattedOptions, valueLower]);


  return (
    <FormItem className={cn("space-y-1", className)}>
      <FormLabel className="flex items-center  text-sm font-medium">
        <span>
          {label} {required && <span className="text-red-500 align-top">*</span>}
        </span>

        {showFormatSwitch && (
          <div className="w-40">
            <Select value={mode} onValueChange={(m: FormatMode) => setMode(m)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                {formatModes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {({
                      none: "No formatting",
                      upper: "UPPERCASE",
                      lower: "lowercase",
                      title: "Title Case",
                      sentence: "Sentence case",
                      numeric: "Numbers only",
                      alphanumeric: "Alphanumeric",
                    } as Record<FormatMode, string>)[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </FormLabel>

      <FormControl>
        <div
            className={cn(
            "relative flex items-center rounded-md border bg-white",
            "focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary",
            "transition-shadow"
          )}
        >
          {/* Left icon */}
          <Search className="ml-2 h-4 w-4 opacity-60" aria-hidden />

          {/* Input */}
          <Input
            disabled={disabled}
            placeholder={placeholder}
            list={listId}
            inputMode={inputMode}
            value={displayValue}
            maxLength={maxLength}
            onChange={(e) => {
              const next = e.target.value;
              // while typing, DON’T trim/collapse; just “soft” filter for modes that must restrict
              const typed = mode === "numeric"
                ? onlyDigits(next)
                : mode === "alphanumeric"
                  ? onlyAlnumSpace(next)
                  : next;
              setRawValue(softApplyFormat(typed, mode));
            }}
            onBlur={() => commit(rawValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(rawValue);
              }
            }}
            className="border-0 shadow-none focus-visible:ring-0 pl-2 pr-4"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />

          <datalist id={listId}>
            {datalistOptions.map((o) => (
              <option key={o.raw} value={o.view} />
            ))}
          </datalist>
        </div>
      </FormControl>
      {pinSuggestions && (fetchedPriority.length || priorityOptions.length) ? (
        <div className="mt-1 flex items-center flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">{pinnedLabel}:</span>
          {dedupeNormalized([...fetchedPriority, ...priorityOptions]).map((p) => {
            const text = applyFormat(normalizeSpaces(p), mode);
            return (
              <Button
                key={p}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={() => commit(text)}
              >
                {text}
              </Button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{description}</span>
        {showCounter && typeof maxLength === "number" && (
          <span>{(field.value?.length ?? 0)}/{maxLength}</span>
        )}
      </div>

      <FormMessage />
    </FormItem>
  );
}
