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

  /** New QoL props */
  description?: string;
  required?: boolean;
  maxLength?: number;
  showCounter?: boolean;
  className?: string;
  priorityOptions?: string[];
  pinSuggestions?: boolean;
  pinnedLabel?: string;
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
}: AutoFillDatalistFieldProps) {
  const [baseOptions, setBaseOptions] = useState<string[]>([]);

  const [mode, setMode] = useState<FormatMode>(formatMode);
  const [loading, setLoading] = useState(false);
  const listId = useId();

  useEffect(() => setMode(formatMode), [formatMode]);

  useEffect(() => {
    let alive = true;
 const priorityUnique = dedupeNormalized(priorityOptions);
    const useStatic = staticOptions && staticOptions.length > 0;
    // staticOptions takes priority
   if (useStatic) {
      const staticUnique = dedupeNormalized(staticOptions!);
      // PRIORITIZE: put priority first, then the rest (no dupes)
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
      .catch(() => { if (alive) setBaseOptions(dedupeNormalized(priorityUnique)); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [endpoint, staticOptions, priorityOptions]);

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


  const datalistOptions = useMemo(() => {
    const curr = value.toLowerCase();
    return formattedOptions.filter(o => o.view.toLowerCase() !== curr);
  }, [formattedOptions, value]);
  return (
    <FormItem className={cn("space-y-1", className)}>
      <FormLabel className="flex items-center justify-between text-sm font-medium">
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
            "relative flex items-center rounded-md"
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
            value={value}
            maxLength={maxLength}
            onChange={(e) => field.onChange(applyFormat(normalizeSpaces(e.target.value), mode))}
            className="border-0 shadow-none focus-visible:ring-0 pl-2 pr-16"
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

      {/* Pinned chips (always visible, not subject to datalist filtering) */}
      {pinSuggestions && priorityOptions?.length ? (
        <div className="mt-1 flex items-center flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">{pinnedLabel}:</span>
          {dedupeNormalized(priorityOptions).map((p) => {
            const text = applyFormat(normalizeSpaces(p), mode);
            return (
              <Button
                key={p}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={() => field.onChange(text)}
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
