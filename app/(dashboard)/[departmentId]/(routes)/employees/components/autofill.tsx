"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Search, X, Loader2, PinIcon } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";


import { parse, isValid, format as fmt } from "date-fns";

const DATE_FORMATS = [
  "MM-dd-yyyy",
  "M-d-yyyy",
  "MM/dd/yyyy",
  "M/d/yyyy",
  "yyyy-MM-dd",
];

function parseStrictDate(input: string): Date | null {
  const v = input.trim();
  for (const f of DATE_FORMATS) {
    const d = parse(v, f, new Date());
    if (isValid(d)) return d;
  }
  return null;
}


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
  liveFormat?: boolean;
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
  liveFormat
}: TextProps) {
  const sanitize = (raw: string) => {
    let v = raw ?? "";
    if (nameSafe) {
      // keep letters (with diacritics), spaces, hyphen, apostrophe
      v = v.replace(/[^\p{L}\p{M}\s'\-]/gu, "");
    }

    if (liveFormat) {
      v = softApplyFormat(v, formatMode);
    }

    field.onChange(v);

    if (normalizeWhitespace) {
      v = v.replace(/\s+/g, " ").trim();
    }
    v = applyFormat(v, formatMode); // uses your existing applyFormat
    return v;
  };

  return (
<FormItem className={cn("space-y-1.5", className)}>
  <div className="flex items-center justify-between">
    <FormLabel className="text-[13px] font-medium tracking-tight">
      {label}
      {required && <span className="ml-1 text-red-600 ">*</span>}
    </FormLabel>
    
    {/* Moved character counter to the top right for a cleaner look */}
    {showCounter && typeof maxLength === "number" && (
      <span className={cn(
        "text-[10px] font-mono transition-opacity tabular-nums",
        (field.value?.length ?? 0) > maxLength * 0.9 ? "text-destructive" : "text-muted-foreground/50"
      )}>
        {(field.value?.length ?? 0)}/{maxLength}
      </span>
    )}
  </div>

  <FormControl>
    <Input
      className="h-9 transition-shadow focus-visible:ring-1" // Thinner focus ring for "minimal" feel
      disabled={disabled}
      placeholder={placeholder}
      value={field.value ?? ""}
      maxLength={maxLength}
      autoCapitalize="words"
      onChange={(e) => {
        const v = e.target.value;
        const soft = nameSafe ? v.replace(/[^\p{L}\p{M}\s'\-]/gu, "") : v;
        field.onChange(soft);
      }}
      onBlur={(e) => {
        if (!autoFormatOnBlur) return;
        field.onChange(sanitize(e.target.value));
      }}
    />
  </FormControl>

  {/* Description and Message - logic to prevent "jumping" UI */}
  <div className="min-h-[1.25rem]"> 
    {description  && (
      <p className="text-[11px] text-muted-foreground/70 leading-none">
        {description}
      </p>
    )}
    <FormMessage className="text-[11px] font-medium" />
  </div>
</FormItem>
  );
}


// NUMBER (string-based to avoid losing leading 0; but constrained)
function NumberField({ label, field, disabled, description, required, className, placeholder, allowDecimal, min, max }: NumberProps) {
  return (
 <FormItem className={cn("group space-y-1.5", className)}>
  <div className="flex items-center justify-between px-0.5">
    <FormLabel className="text-[13px] font-medium text-foreground/90">
      {label}
      {required && <span className="ml-1 text-red-600 text-destructive">*</span>}
    </FormLabel>

    {/* Subtle Min/Max indicator for UX clarity */}
    {(min !== undefined || max !== undefined) && (
      <span className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground/50">
        {min !== undefined && `${min} min`} 
        {min !== undefined && max !== undefined && " — "}
        {max !== undefined && `${max} max`}
      </span>
    )}
  </div>

  <FormControl>
    <div className="relative">
      <Input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        placeholder={placeholder}
        disabled={disabled}
        value={field.value ?? ""}
        className="h-9 border-muted bg-background/50 transition-all focus:bg-background focus:ring-1 focus:ring-ring"
        onChange={(e) => {
          const raw = e.target.value;
          const cleaned = allowDecimal
            ? raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
            : raw.replace(/\D/g, "");
          
          let next = cleaned;
          if (next !== "" && !isNaN(Number(next))) {
            const n = Number(next);
            if (min !== undefined && n < min) next = String(min);
            if (max !== undefined && n > max) next = String(max);
          }
          field.onChange(next);
        }}
      />
      {/* Visual Unit Hint (Optional) - e.g., if it's a percentage or currency */}
      {allowDecimal && (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-muted-foreground/30">
          .00
        </div>
      )}
    </div>
  </FormControl>

  {description && <p className="text-[11px] leading-relaxed text-muted-foreground/70">{description}</p>}
  <FormMessage className="text-[11px] font-medium tracking-tight" />
</FormItem>
  );
}

// PHONE (PH 11-digit, pretty display with hyphens)
function PhoneField({ label, field, disabled, description, required, className, placeholder = "09XXXXXXXXX" }: PhoneProps) {
  const display = formatPHPretty(field.value ?? "");
  return (
  <FormItem className={cn("space-y-1.5", className)}>
  <FormLabel className="text-[13px] font-medium text-foreground/90">
    {label}
    {required && <span className="ml-1 text-red-600 text-destructive">*</span>}
  </FormLabel>

  <FormControl>
    <div className="relative group">
      {/* Visual Prefix - Fixed +63 styling */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 border-r pr-2.5 h-4 text-muted-foreground/60">
        <span className="text-[10px] font-bold tracking-tighter">PH</span>
        <span className="text-xs font-medium">+63</span>
      </div>

      <Input
        type="text"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={placeholder ?? "912 345 6789"}
        value={display}
        className={cn(
          "h-10 pl-[72px] font-mono tracking-widest transition-all",
          "bg-background/50 focus:bg-background focus:ring-1"
        )}
        onChange={(e) => field.onChange(normalizePHMobileLive(e.target.value))}
        onBlur={(e) => field.onChange(normalizePHMobileLive(e.target.value))}
      />
    </div>
  </FormControl>

  <FormMessage className="text-[11px] font-medium" />
</FormItem>
  );
}

// DATE (shadcn Calendar + Popover)
function DateField({
  label,
  field,
  disabled,
  description,
  required,
  className,
  fromYear,
  toYear,
  disableFuture,
  placeholder = "",
}: DateProps) {
  const selected: Date | undefined =
    field.value ? new Date(field.value) : undefined;

  const [input, setInput] = useState(
    selected ? fmt(selected, "MM-dd-yyyy") : ""
  );



  const [month, setMonth] = useState<Date | undefined>(
    selected ?? new Date()
  );
  // keep input synced if value changes externally
  useEffect(() => {
    if (selected) {
      setInput(fmt(selected, "MM-dd-yyyy"));
    }
  }, [field.value]);

  const commitInput = () => {
    if (!input) {
      field.onChange(undefined);
      return;
    }

    const parsed = parseStrictDate(input);
    if (!parsed) {
      // revert on invalid
      setInput(selected ? fmt(selected, "MM-dd-yyyy") : "");
      return;
    }

    setMonth(parsed);

    if (disableFuture && parsed > new Date()) {
      setInput(selected ? fmt(selected, "MM-dd-yyyy") : "");
      return;
    }

    field.onChange(parsed);
    setInput(fmt(parsed, "MM-dd-yyyy")); // normalize
  };


  useEffect(() => {
    if (selected) {
      setMonth(selected);
      setInput(fmt(selected, "MM-dd-yyyy"));
    }
  }, [field.value]);

  return (
  <FormItem className={cn("space-y-1.5", className)}>
  <FormLabel className="text-[13px] font-medium text-foreground/90">
    {label}
    {required && <span className="ml-1 text-red-600 text-destructive">*</span>}
  </FormLabel>

  <FormControl>
    <Popover>
      <div className="relative group">
        <Input
          type="text"
          inputMode="numeric"
          placeholder={placeholder ?? "MM-DD-YYYY"}
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commitInput}
          className={cn(
            "h-9 pr-11 font-mono tabular-nums transition-all", 
            "focus-visible:ring-1 focus-visible:border-primary/50"
          )}
        />

        {/* Integrated Trigger: Border-left makes it feel like a unified tool */}
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "absolute right-0 top-0 h-full px-3 flex items-center justify-center",
              "text-muted-foreground/60 hover:text-primary transition-colors",
              "border-l border-transparent group-hover:border-input"
            )}
            tabIndex={-1}
            disabled={disabled}
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent 
        align="end" 
        className="w-auto p-2 border-border/50 shadow-xl backdrop-blur-sm"
      >
        <Calendar
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          captionLayout="dropdown-buttons"
          className="rounded-md border-none"
          onSelect={(d) => {
            if (!d) return;
            field.onChange(d);
            setInput(fmt(d, "MM-dd-yyyy"));
            setMonth(d);
          }}
          fromYear={fromYear}
          toYear={toYear}
          disabled={(d) => !!disableFuture && d > new Date()}
        />
      </PopoverContent>
    </Popover>
  </FormControl>
  <FormMessage className="text-[11px]" />
</FormItem>
  );
}



// DATALIST (with endpoint/static, dedupe, priority, optional format switch & chips)
function DatalistField({
  label, field, disabled, description, required, className, placeholder,
  endpoint, staticOptions, priorityOptions = [], pinSuggestions, pinnedLabel,
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
<FormItem className={cn("group space-y-1.5", className)}>
  <div className="flex items-center justify-between">
    <FormLabel className="text-[13px] font-medium tracking-tight text-foreground/90">
      {label} {required && <span className="text-red-600 text-destructive ml-0.5">*</span>}
    </FormLabel>

    {showFormatSwitch && (
      <Select value={mode} onValueChange={(m: FormatMode) => setMode(m)}>
        <SelectTrigger className="h-6 w-fit border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-primary shadow-none focus:ring-0">
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent align="end" className="text-xs">
          {(formatModes ?? ALL_MODES).map((m) => (
            <SelectItem key={m} value={m} className="text-xs">
              {m.charAt(0).toUpperCase() + m.slice(1)} Case
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
  </div>

  <FormControl>
    <div className={cn(
      "relative flex items-center rounded-lg border border-input bg-background transition-all duration-200",
      "focus-within:ring-1 focus-within:ring-ring focus-within:border-ring/50 shadow-sm"
    )}>
      {/* Search Icon - Muted unless active */}
      <div className="pl-3 text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors">
        <Search className="h-3.5 w-3.5" aria-hidden />
      </div>

      <Input
        disabled={disabled}
        placeholder={placeholder}
        list={listId}
        inputMode={inputMode}
        value={value}
        maxLength={maxLength}
        onChange={(e) => field.onChange(softApplyFormat(e.target.value, mode))}
        onBlur={(e) => field.onChange(applyFormat(normalizeSpaces(e.target.value), mode))}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-9 px-2.5 text-sm placeholder:text-muted-foreground/50"
        autoCapitalize="off" autoComplete="off" spellCheck={false}
      />

      <div className="absolute right-1.5 flex items-center gap-1.5">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
        ) : value ? (
          <button 
            type="button" 
            onClick={() => field.onChange("")}
            className="rounded-full p-1 text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <datalist id={listId}>
        {datalistOptions.map((o) => (
          <option key={o.raw} value={o.view} />
        ))}
      </datalist>
    </div>
  </FormControl>

  {/* Pinned Suggestions - Integrated seamlessly */}
  {pinSuggestions && (priority.length > 0 || (priorityOptions?.length ?? 0) > 0) && (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">
        {pinnedLabel || "Quick Select"}
      </span>
      {[...priority, ...dedupeNormalized(priorityOptions ?? [])].map((p, idx) => {
        const txt = applyFormat(normalizeSpaces(p), mode);
        return (
          <button
            key={`${p}-${idx}`}
            type="button"
            onClick={() => field.onChange(txt)}
            className="h-5 rounded-md bg-secondary/50 px-2 text-[10px] font-medium text-secondary-foreground hover:bg-secondary transition-colors active:scale-95"
          >
            {txt}
          </button>
        );
      })}
    </div>
  )}

  {/* Footer info: Description and Counter */}
  {(description || showCounter) && (
    <div className="flex items-center justify-between px-0.5 pt-1">
      <p className="text-[11px] text-muted-foreground/60 italic">{description}</p>
      {showCounter && typeof maxLength === "number" && (
        <span className="text-[10px] tabular-nums font-mono text-muted-foreground/40">
          {field.value?.length ?? 0}<span className="mx-0.5">/</span>{maxLength}
        </span>
      )}
    </div>
  )}
  
  <FormMessage className="text-[11px] font-medium" />
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
  // 👇 ADD THESE
  const [open, setOpen] = useState(false);
  const selected = byValue.get(currentValue.toLowerCase());


  // ----- RENDER --------
  return (
 <FormItem className={cn("space-y-2", className)}>
  <div className="flex items-center justify-between px-0.5">
    <FormLabel className="text-[13px] font-medium text-foreground/90">
      {label} {required && <span className="text-red-600 ml-0.5">*</span>}
    </FormLabel>
    {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />}
  </div>

  <FormControl>
    <div className="relative group">
      {searchable ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled || loading}
              className={cn(
                "w-full justify-between h-9 px-3 font-normal transition-all",
                "bg-background/50 hover:bg-background border-input hover:border-accent-foreground/20",
                !hasValue && "text-muted-foreground/60",
                allowClear && hasValue && "pr-10"
              )}
            >
              <span className="truncate">
                {selected ? selected.label : (loading ? "Loading..." : placeholder)}
              </span>
              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
            </Button>
          </PopoverTrigger>

          <PopoverContent 
            className="w-[var(--radix-popover-trigger-width)] p-1 shadow-xl border-border/50 backdrop-blur-md" 
            align="start"
          >
            <Command className="bg-transparent" shouldFilter>
              <CommandInput 
                placeholder={searchPlaceholder ?? "Search..."} 
                className="h-8 text-sm border-none focus:ring-0" 
              />
              <CommandEmpty className="py-3 text-[11px] text-center text-muted-foreground">
                No results found.
              </CommandEmpty>
              <CommandList className="max-h-64 scrollbar-thin">
                <CommandGroup>
                  {ordered.map(opt => (
                    <CommandItem
                      key={opt.value}
                      className="rounded-sm text-sm py-1.5 px-2 cursor-pointer"
                      onSelect={() => {
                        field.onChange(String(opt.value).trim());
                        pushRecent(opt);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn(
                        "mr-2 h-3.5 w-3.5 text-primary transition-all",
                        currentValue.toLowerCase() === opt.value.toLowerCase() ? "scale-100 opacity-100" : "scale-50 opacity-0"
                      )} />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        /* FALLBACK: Minimal Select Styling */
        <Select
          disabled={disabled || loading}
          value={currentValue}
          onValueChange={(v) => {
            field.onChange(v.trim());
            const hit = byValue.get(v.toLowerCase());
            if (hit) pushRecent(hit);
          }}
        >
          <SelectTrigger className="h-9 bg-background/50 hover:bg-background transition-all">
            <SelectValue placeholder={loading ? "Loading..." : placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-52">
            {ordered.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Modern Clear Button: Inside the trigger area */}
      {allowClear && hasValue && !disabled && !loading && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            field.onChange("");
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-all"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  </FormControl>

  {/* Pinned & Recents: Refined Chips */}
  {pinSuggestions && (recents.length > 0 || priFixed.length > 0 || propPriFixed.length > 0) && (
    <div className="flex flex-col gap-2 px-0.5 pt-1">
      {/* Grouping both Pinned and Recents in one row to save vertical space */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[...priFixed, ...propPriFixed, ...recents].slice(0, 6).map((opt, i) => (
          <button
            key={`${opt.value}-${i}`}
            type="button"
            onClick={() => {
              field.onChange(opt.value);
              pushRecent(opt);
            }}
            className={cn(
              "flex items-center gap-1 h-5 px-2 rounded-md text-[10px] font-medium transition-all active:scale-95",
              i < (priFixed.length + propPriFixed.length) 
                ? "bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10" 
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
            )}
          >
            {i < (priFixed.length + propPriFixed.length) && <PinIcon className="h-2 w-2 opacity-70" />}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )}

  {description && <p className="text-[11px] text-muted-foreground/60 px-0.5">{description}</p>}
  <FormMessage className="text-[11px] font-medium" />
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
  <FormItem className={cn("space-y-1.5", className)}>
  <div className="flex items-center justify-between px-0.5">
    <FormLabel className="text-[13px] font-medium text-foreground/90">
      {label}
      {required && <span className="ml-1 text-red-600 text-destructive">*</span>}
    </FormLabel>

    {/* Counter moved to top for better visibility during long typing sessions */}
    {showCounter && typeof maxLength === "number" && (
      <span className={cn(
        "text-[10px] font-mono tabular-nums transition-colors",
        value.length >= maxLength ? "text-destructive font-bold" : "text-muted-foreground/40"
      )}>
        {value.length} / {maxLength}
      </span>
    )}
  </div>

  <FormControl>
    <Textarea
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      rows={rows}
      maxLength={maxLength}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={(e) => field.onChange(normalizeSpaces(e.target.value))}
      className={cn(
        "min-h-[80px] resize-none border-input bg-background/50 p-3 shadow-sm transition-all",
        "placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background",
        "scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20"
      )}
    />
  </FormControl>

  {description && (
    <p className="text-[11px] leading-relaxed text-muted-foreground/60 px-0.5">
      {description}
    </p>
  )}
  
  <FormMessage className="text-[11px] font-medium" />
</FormItem>
  );
}
