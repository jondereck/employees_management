"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Search, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";



/** ---------- Formatting helpers ---------- */
type FormatMode = "none" | "upper" | "lower" | "title" | "sentence" | "numeric" | "alphanumeric";
const ALL_MODES: FormatMode[] = ["none", "upper", "lower", "title", "sentence", "numeric", "alphanumeric"];

const toTitleCase = (s: string) =>
  s.toLowerCase().split(/\s+/).map(w => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ");
const toSentenceCase = (s: string) => {
  const t = s.trim();
  if (!t) return t;
  const lower = t.toLowerCase();
  return lower[0].toUpperCase() + lower.slice(1);
};
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const onlyAlnumSpace = (s: string) => s.replace(/[^a-z0-9 ]/gi, "");
const normalizeSpaces = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

const applyFormat = (val: string, mode: FormatMode): string => {
  switch (mode) {
    case "upper": return val.toUpperCase();
    case "lower": return val.toLowerCase();
    case "title": return toTitleCase(val);
    case "sentence": return toSentenceCase(val);
    case "numeric": return onlyDigits(val);
    case "alphanumeric": return onlyAlnumSpace(val);
    default: return val;
  }
};
const dedupeNormalized = (arr: string[]) => {
  const seen = new Set<string>(), out: string[] = [];
  for (const x of arr) {
    const clean = normalizeSpaces(x);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); out.push(clean); }
  }
  return out;
};

/** ---------- Phone helpers ---------- */
// live normalizer: add 0 if starts with 9; trim to 11; tolerate 63/009 prefixes
export function normalizePHMobileLive(input: string): string {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.startsWith("009")) d = d.slice(2);
  if (d.startsWith("63")) d = d.slice(2);
  if (d.startsWith("9")) return ("0" + d).slice(0, 11);
  if (d.startsWith("0")) return d.slice(0, 11);
  return d.slice(0, 11);
}
export function formatPHPretty(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  const p1 = d.slice(0, 4);
  const p2 = d.slice(4, 7);
  const p3 = d.slice(7, 11);
  return [p1, p2, p3].filter(Boolean).join("-");
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


type SelectOption = { value: string; label: string };

type SelectFetchProps = {
  optionsEndpoint?: string;
  options?: SelectOption[];
  /** NEW: suggestion chips */
  priorityEndpoint?: string;           // returns string[] or {id/name}[]
  priorityOptions?: (SelectOption | string)[];
  pinSuggestions?: boolean;
  pinnedLabel?: string;
};

type SelectProps = BaseProps & SelectFetchProps & {
  kind: "select";
  placeholder?: string;

  recentKey?: string;       // e.g. "eligibilityId"
  recentMax?: number;       // e.g. 3
  recentLabel?: string;     // e.g. "Recently used"

  allowClear?: boolean;          // show small X when there is a value
  clearLabel?: string;

  searchable?: boolean;             // NEW
  searchPlaceholder?: string;       // NEW
};

type TextareaProps = BaseProps & {
  kind: "textarea";
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCounter?: boolean;
};


/** ---------- Props ---------- */
type Kind = "text" | "datalist" | "phone" | "number" | "date" | "select";
type RHFField = { value?: any; onChange: (v: any) => void };

type BaseProps = {
  label: string;
  field: RHFField;
  disabled?: boolean;
  description?: string;
  required?: boolean;
  className?: string;

};

type DatalistProps = BaseProps & {
  kind: "datalist";
  placeholder?: string;
  endpoint?: string;          // returns string[] or { popular, options }
  staticOptions?: string[];
  priorityOptions?: string[]; // pinned/top suggestions (e.g. user pins or popular)
  priorityEndpoint?: string;
  pinSuggestions?: boolean;
  pinnedLabel?: string;
  showFormatSwitch?: boolean;
  formatMode?: FormatMode;
  formatModes?: FormatMode[];
  maxLength?: number;
  showCounter?: boolean;
};

type PhoneProps = BaseProps & {
  kind: "phone";
  placeholder?: string;
};

type NumberProps = BaseProps & {
  kind: "number";
  placeholder?: string;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  step?: number | "any";
};

type DateProps = BaseProps & {
  kind: "date";
  fromYear?: number;
  toYear?: number;
  disableFuture?: boolean;
  placeholder?: string;
};

type TextProps = BaseProps & {
  kind: "text";
  placeholder?: string;
  maxLength?: number;
  showCounter?: boolean;
  formatMode?: FormatMode;         // e.g. "title" | "upper" | "none"
  normalizeWhitespace?: boolean;   // collapse multiple spaces, trim ends
  nameSafe?: boolean;              // allow letters, spaces, hyphen, apostrophe only
  autoFormatOnBlur?: boolean;
};

type AutoFieldProps =
  | DatalistProps
  | PhoneProps
  | NumberProps
  | DateProps
  | TextProps
  | SelectProps
  | TextareaProps;
/** ---------- Component ---------- */
export function AutoField(props: AutoFieldProps) {
  switch (props.kind) {
    case "date": return <DateField {...props} />;
    case "phone": return <PhoneField {...props} />;
    case "number": return <NumberField {...props} />;
    case "datalist": return <DatalistField {...props} />;
    case "select": return <SelectField {...props} />;
    case "textarea": return <TextareaField {...props} />;
    case "text":
    default: return <TextField {...props} />;
  }
}


/** ---------- Sub-fields ---------- */

// TEXT
function TextField({
  label, field, disabled, description, required, className,
  placeholder, maxLength, showCounter,
  formatMode = "none",
  normalizeWhitespace = true,
  nameSafe = true,
  autoFormatOnBlur = true,
}: TextProps) {
  const sanitize = (raw: string) => {
    let v = raw ?? "";
    if (nameSafe) {
      // keep letters (with diacritics), spaces, hyphen, apostrophe
      v = v.replace(/[^\p{L}\p{M}\s'\-]/gu, "");
    }
    if (normalizeWhitespace) {
      v = v.replace(/\s+/g, " ").trim();
    }
    v = applyFormat(v, formatMode); // uses your existing applyFormat
    return v;
  };

  return (
    <FormItem className={className}>
      <FormLabel>
        {label} {required && <span className="text-red-500">*</span>}
      </FormLabel>
      <FormControl>
        <Input
          disabled={disabled}
          placeholder={placeholder}
          value={field.value ?? ""}
          maxLength={maxLength}
          autoCapitalize="words"
          onChange={(e) => {
            // live-sanitize but be gentle (don’t over-trim while typing)
            const v = e.target.value;
            // permit typing space/hyphen/apostrophe; normalize softly
            const soft = nameSafe ? v.replace(/[^\p{L}\p{M}\s'\-]/gu, "") : v;
            field.onChange(soft);
          }}
          onBlur={(e) => {
            if (!autoFormatOnBlur) return;
            field.onChange(sanitize(e.target.value));
          }}
        />
      </FormControl>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{description}</span>
        {showCounter && typeof maxLength === "number" && (
          <span>{(field.value?.length ?? 0)}/{maxLength}</span>
        )}
      </div>
      <FormMessage />
    </FormItem>
  );
}


// NUMBER (string-based to avoid losing leading 0; but constrained)
function NumberField({ label, field, disabled, description, required, className, placeholder, allowDecimal, min, max }: NumberProps) {
  return (
    <FormItem className={className}>
      <FormLabel>{label} {required && <span className="text-red-500">*</span>}</FormLabel>
      <FormControl>
        <Input
          type="text"
          inputMode={allowDecimal ? "decimal" : "numeric"}
          placeholder={placeholder}
          disabled={disabled}
          value={field.value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            const cleaned = allowDecimal
              ? raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1") // one dot
              : raw.replace(/\D/g, "");
            // clamp min/max if both numeric
            let next = cleaned;
            if (next !== "" && !isNaN(Number(next))) {
              const n = Number(next);
              if (min !== undefined && n < min) next = String(min);
              if (max !== undefined && n > max) next = String(max);
            }
            field.onChange(next);
          }}
        />
      </FormControl>
      <p className="text-xs text-muted-foreground">{description}</p>
      <FormMessage />
    </FormItem>
  );
}

// PHONE (PH 11-digit, pretty display with hyphens)
function PhoneField({ label, field, disabled, description, required, className, placeholder = "09XXXXXXXXX" }: PhoneProps) {
  const display = formatPHPretty(field.value ?? "");
  return (
    <FormItem className={className}>
      <FormLabel>{label} {required && <span className="text-red-500">*</span>}</FormLabel>
      <FormControl>
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={placeholder}
          value={display}
          onChange={(e) => field.onChange(normalizePHMobileLive(e.target.value))}
          onBlur={(e) => field.onChange(normalizePHMobileLive(e.target.value))}
        />
      </FormControl>
      <p className="text-xs text-muted-foreground">{description ?? "Optional"}</p>
      <FormMessage />
    </FormItem>
  );
}

// DATE (shadcn Calendar + Popover)
function DateField({ label, field, disabled, description, required, className, fromYear, toYear, disableFuture, placeholder = "Pick a date" }: DateProps) {
  const currentYear = new Date().getFullYear();
  const fromY = fromYear ?? currentYear - 100;
  const toY = toYear ?? currentYear;

  const selected: Date | undefined = field.value ? new Date(field.value) : undefined;
  return (
    <FormItem className={cn("flex flex-col", className)}>
      <FormLabel>{label} {required && <span className="text-red-500">*</span>}</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-auto justify-start text-left font-normal", !selected && "text-muted-foreground")} disabled={disabled}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            captionLayout="dropdown-buttons"
            selected={selected}
            onSelect={(d) => field.onChange(d ?? undefined)}
            fromYear={fromY}
            toYear={toY}
            disabled={(date) => !!disableFuture && date > new Date()}
          />
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">{description}</p>
      <FormMessage />
    </FormItem>
  );
}


// DATALIST (with endpoint/static, dedupe, priority, optional format switch & chips)
function DatalistField({
  label, field, disabled, description, required, className, placeholder = "Search or enter...",
  endpoint, staticOptions, priorityOptions = [], pinSuggestions, pinnedLabel = "Suggestions",
  showFormatSwitch, formatMode = "none", formatModes = ALL_MODES, maxLength, showCounter, priorityEndpoint
}: DatalistProps) {
  const [baseOptions, setBaseOptions] = useState<string[]>([]);
  const [mode, setMode] = useState<FormatMode>(formatMode);
  const [loading, setLoading] = useState(false);

  const [priority, setPriority] = useState<string[]>([]);

  useEffect(() => setMode(formatMode), [formatMode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!priorityEndpoint) { setPriority([]); return; }
        const r = await fetch(priorityEndpoint, { cache: "no-store" });
        const d = await r.json().catch(() => null);
        const pri = Array.isArray(d)
          ? d
          : d && Array.isArray(d.popular) ? d.popular
            : d && Array.isArray(d.items) ? d.items
              : [];
        if (alive) setPriority(dedupeNormalized(pri));
      } catch {
        if (alive) setPriority([]);
      }
    })();
    return () => { alive = false; };
  }, [priorityEndpoint]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (staticOptions?.length) { setBaseOptions(dedupeNormalized(staticOptions)); return; }
        if (!endpoint) { setBaseOptions([]); return; }
        setLoading(true);
        const res = await fetch(endpoint, { cache: "no-store" });
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        if (alive) setBaseOptions(dedupeNormalized(arr));
      } catch {
        if (alive) setBaseOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [endpoint, staticOptions]);

  const ordered = useMemo(() => dedupeNormalized([...priority, ...baseOptions]), [priority, baseOptions]);

  // datalist id: stable
  const listId = useId();

  const value = field.value ?? ""; // keep raw while typing; format onBlur
  const inputMode = mode === "numeric" ? "numeric" : undefined;

  const formattedOptions = useMemo(() => {
    const seen = new Set<string>(), out: { raw: string; view: string }[] = [];
    for (const raw of ordered) {                            // <-- changed
      const clean = normalizeSpaces(raw);
      const view = applyFormat(clean, mode);
      const key = view.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push({ raw: clean, view }); }
    }
    return out;
  }, [ordered, mode]);

  const datalistOptions = formattedOptions;  // 👈 show everything

  const filteredOptions = formattedOptions;

  return (
    <FormItem className={cn("space-y-1", className)}>
      <FormLabel className="flex items-center justify-between text-sm font-medium">
        <span>{label} {required && <span className="text-red-500">*</span>}</span>
        {showFormatSwitch && (
          <div className="w-40">
            <Select value={mode} onValueChange={(m: FormatMode) => setMode(m)}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Format" /></SelectTrigger>
              <SelectContent>
                {(formatModes ?? ALL_MODES).map((m) => (
                  <SelectItem key={m} value={m}>
                    {({
                      none: "No formatting", upper: "UPPERCASE", lower: "lowercase", title: "Title Case",
                      sentence: "Sentence case", numeric: "Numbers only", alphanumeric: "Alphanumeric"
                    } as Record<FormatMode, string>)[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </FormLabel>

      <FormControl>
        <div className={cn(
          "relative flex items-center rounded-md border bg-white",
          "focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary",
          "transition-shadow"
        )}>
          <Search className="ml-2 h-4 w-4 opacity-60" aria-hidden />
          <Input
            disabled={disabled}
            placeholder={placeholder}
            list={listId}
            inputMode={inputMode}
            value={value}
            maxLength={maxLength}
            onChange={(e) => field.onChange(softApplyFormat(e.target.value, mode))}
            onBlur={(e) => field.onChange(applyFormat(normalizeSpaces(e.target.value), mode))}
            className="border-0 shadow-none focus-visible:ring-0 pl-2 pr-16"
            autoCapitalize="off" autoComplete="off" spellCheck={false}
          />
          <div className="absolute right-1 flex items-center gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin opacity-70" /> :
              value ? (
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => field.onChange("")} title="Clear">
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
          </div>
          <datalist id={listId}>
            {datalistOptions.map((o) => (
              <option key={o.raw} value={o.view} />
            ))}
          </datalist>
        </div>
      </FormControl>

      {pinSuggestions && (priority.length > 0 || (priorityOptions?.length ?? 0) > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{pinnedLabel}</span>

          {/* Chips from fetched priorityEndpoint  ✅ */}
          {priority.map((p) => {
            const txt = applyFormat(normalizeSpaces(p), mode);
            return (
              <Button
                key={`pri-${p}`}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={() => field.onChange(txt)}
              >
                {txt}
              </Button>
            );
          })}

          {/* Chips from prop-based priorityOptions (existing) */}
          {dedupeNormalized(priorityOptions ?? []).map((p) => {
            const txt = applyFormat(normalizeSpaces(p), mode);
            return (
              <Button
                key={`prop-${p}`}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={() => field.onChange(txt)}
              >
                {txt}
              </Button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{description}</span>
        {showCounter && typeof maxLength === "number" && <span>{(field.value?.length ?? 0)}/{maxLength}</span>}
      </div>
      <FormMessage />
    </FormItem>
  );
}

// SELECT (with endpoint/static options)
function SelectField({
  label, field, disabled, description, required, className,
  placeholder = "Select...",
  optionsEndpoint, options,

  // Suggestions / pins
  priorityEndpoint,
  priorityOptions = [],
  pinSuggestions,
  pinnedLabel = "Suggestions",

  // Recents
  recentKey,
  recentMax = 3,
  recentLabel = "Recently used",

  // Clear button
  allowClear = false,
  clearLabel = "Clear selection",

  // Searchable combobox
  searchable,
  searchPlaceholder,
}: SelectProps) {
  type SelectOption = { value: string; label: string };

  const normalizeOpt = (v: any) => String(v ?? "").trim();
  const normalizeLabel = (v: any) => String(v ?? "").trim();

  // Convert various payload shapes into SelectOption[]
  function toOptions(data: any): SelectOption[] {
    if (!data) return [];
    const make = (x: any): SelectOption | null => {
      // strings
      if (typeof x === "string") {
        const v = normalizeOpt(x);
        if (!v) return null;
        return { value: v, label: v };
      }
      // { value, label }
      if (x && (x.value ?? x.label)) {
        const value = normalizeOpt(x.value);
        const label = normalizeLabel(x.label ?? x.value);
        if (!value) return null;
        return { value, label };
      }
      // { id, name }
      if (x && (x.id ?? x.name)) {
        const value = normalizeOpt(x.id);
        const label = normalizeLabel(x.name ?? x.id);
        if (!value) return null;
        return { value, label };
      }
      return null;
    };

    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.popular)
      ? data.popular
      : [];

    const seen = new Set<string>();
    const out: SelectOption[] = [];
    for (const raw of arr) {
      const opt = make(raw);
      if (!opt) continue;
      const key = opt.value.toLowerCase(); // dedupe by normalized value
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(opt);
    }
    return out;
  }

  const [opts, setOpts] = useState<SelectOption[]>(options ?? []);
  const [loading, setLoading] = useState(false);
  const [pri, setPri] = useState<SelectOption[]>([]);
  const [recents, setRecents] = useState<SelectOption[]>([]);

  // Fetch main options (if endpoint provided)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!optionsEndpoint) return;
      setLoading(true);
      try {
        const r = await fetch(optionsEndpoint, { cache: "no-store" });
        const d = await r.json().catch(() => null);
        if (!alive) return;
        setOpts(toOptions(d));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [optionsEndpoint]);

  // Fetch priority suggestions (if endpoint provided)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!priorityEndpoint) {
        setPri([]);
        return;
      }
      try {
        const r = await fetch(priorityEndpoint, { cache: "no-store" });
        const d = await r.json().catch(() => null);
        if (!alive) return;
        setPri(toOptions(d));
      } catch {
        if (alive) setPri([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [priorityEndpoint]);

  // Prop-based priority (strings or SelectOption)
  const propPri: SelectOption[] = useMemo(() => toOptions(priorityOptions), [priorityOptions]);

  // Load recents from localStorage
  useEffect(() => {
    if (!recentKey) return;
    try {
      const raw = localStorage.getItem(`recent:${recentKey}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as SelectOption[];
      setRecents(Array.isArray(saved) ? saved.slice(0, recentMax) : []);
    } catch {
      /* ignore */
    }
  }, [recentKey, recentMax]);

  const pushRecent = (opt: SelectOption) => {
    if (!recentKey) return;
    try {
      const raw = localStorage.getItem(`recent:${recentKey}`);
      const list: SelectOption[] = raw ? JSON.parse(raw) : [];
      const norm = {
        value: normalizeOpt(opt.value),
        label: normalizeLabel(opt.label),
      };
      const next = [norm, ...list.filter(x => normalizeOpt(x.value).toLowerCase() !== norm.value.toLowerCase())]
        .slice(0, recentMax);
      localStorage.setItem(`recent:${recentKey}`, JSON.stringify(next));
      setRecents(next);
    } catch {
      /* ignore */
    }
  };

  // 1) Base (authoritative) from opts
  const base = useMemo(() => {
    const seen = new Set<string>();
    const nn: SelectOption[] = [];
    for (const o of toOptions(opts)) {
      const value = normalizeOpt(o.value);
      const label = normalizeLabel(o.label);
      const k = value.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      nn.push({ value, label });
    }
    return nn;
  }, [opts]);

  // 2) Index base by label (lowercased) -> value (ID)
  const valueByLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of base) m.set(o.label.toLowerCase(), o.value);
    return m;
  }, [base]);

  // 3) “Snap” label-only items to base IDs
  const fixToBaseIds = (list: any): SelectOption[] => {
    const out: SelectOption[] = [];
    for (const o of toOptions(list)) {
      const label = normalizeLabel(o.label);
      let value = normalizeOpt(o.value);
      const maybe = valueByLabel.get(label.toLowerCase());
      if (maybe) value = maybe;
      out.push({ value, label });
    }
    return out;
  };

  const priFixed = useMemo(() => fixToBaseIds(pri), [pri, valueByLabel]);
  const propPriFixed = useMemo(() => fixToBaseIds(propPri), [propPri, valueByLabel]);

  // 4) Merge (priority first), then dedupe by value (ID)
  const ordered = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...priFixed, ...propPriFixed, ...base];
    const out: SelectOption[] = [];
    for (const o of merged) {
      const value = normalizeOpt(o.value);
      const label = normalizeLabel(o.label);
      const k = value.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ value, label });
    }
    return out;
  }, [priFixed, propPriFixed, base]);

  // Fast lookup by value
  const byValue = useMemo(() => {
    const m = new Map<string, SelectOption>();
    for (const o of ordered) m.set(o.value.toLowerCase(), o);
    return m;
  }, [ordered]);

  const hasValue = Boolean(field.value);
  const currentValue = field.value == null ? "" : String(field.value).trim();

  // ----- RENDER -----
  return (
    <FormItem className={className}>
      <FormLabel>
        {label} {required && <span className="text-red-500">*</span>}
      </FormLabel>

      <FormControl>
        <div className="relative">
          {searchable ? (
            // SEARCHABLE COMBOBOX
            (() => {
              const [open, setOpen] = useState(false);
              const selected = byValue.get(currentValue.toLowerCase());
              return (
                <>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("w-full justify-between", allowClear && hasValue ? "pr-9" : undefined)}
                        disabled={disabled || loading}
                      >
                        {selected ? selected.label : (loading ? "Loading..." : placeholder)}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command shouldFilter>
                        <CommandInput placeholder={searchPlaceholder ?? "Search..."} />
                        <CommandEmpty>No results.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {ordered.map(opt => (
                              <CommandItem
                                key={opt.value}
                                value={`${opt.label} ${opt.value}`}
                                onSelect={() => {
                                  const nv = String(opt.value).trim();
                                  field.onChange(nv);
                                  pushRecent(opt);
                                  setOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currentValue.toLowerCase() === opt.value.toLowerCase()
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {opt.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Clear (X) button */}
                  {allowClear && hasValue && !disabled && !loading && (
                    <button
                      type="button"
                      aria-label={clearLabel}
                      title={clearLabel}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        field.onChange("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </>
              );
            })()
          ) : (
            // FALLBACK: shadcn Select
            <Select
              disabled={disabled || loading}
              value={currentValue}
              onValueChange={(v) => {
                const nv = String(v).trim();
                field.onChange(nv);
                const hit = byValue.get(nv.toLowerCase());
                if (hit) pushRecent(hit);
              }}
            >
              <SelectTrigger className={cn("w-full", allowClear && hasValue ? "pr-9" : undefined)}>
                <SelectValue placeholder={loading ? "Loading..." : placeholder} />
              </SelectTrigger>
              <SelectContent className="max-h-52 overflow-y-auto">
                {ordered.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </FormControl>

      <p className="text-xs text-muted-foreground">{description}</p>

      {/* Pinned/Recent chips */}
      {pinSuggestions && (recents.length > 0 || priFixed.length > 0 || propPriFixed.length > 0) && (
        <div className="mt-2 space-y-1">
          {recents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{recentLabel}</span>
              {recents.map(opt => (
                <Button
                  key={`recent-${opt.value}`}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => {
                    field.onChange(opt.value);
                    pushRecent(opt);
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}

          {(priFixed.length > 0 || propPriFixed.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{pinnedLabel}</span>
              {[...priFixed, ...propPriFixed].map(opt => (
                <Button
                  key={`pin-${opt.value}`}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => {
                    field.onChange(opt.value); // ensure ID is set
                    pushRecent(opt);
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <FormMessage />
    </FormItem>
  );
}



// TEXTAREA
// shadcn textarea

function TextareaField({
  label, field, disabled, description, required, className,
  placeholder, rows = 4, maxLength, showCounter,
}: TextareaProps) {
  const value: string = field.value ?? "";
  return (
    <FormItem className={className}>
      <FormLabel>{label} {required && <span className="text-red-500">*</span>}</FormLabel>
      <FormControl>
        <Textarea
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          rows={rows}
          maxLength={maxLength}
          onChange={(e: any) => field.onChange(e.target.value)}
          onBlur={(e: any) => field.onChange(normalizeSpaces(e.target.value))}
        />
      </FormControl>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{description}</span>
        {showCounter && typeof maxLength === "number" && (
          <span>{value.length}/{maxLength}</span>
        )}
      </div>
      <FormMessage />
    </FormItem>
  );
}
