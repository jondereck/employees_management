"use client";

import { useState, useEffect } from "react";
import {
  FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Command, CommandInput, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

type FormatMode =
  | "none"
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "numeric"
  | "alphanumeric";

interface AutoFillFieldProps {
  label: string;
  field: { value?: string; onChange: (v: string) => void }; // RHF field
  endpoint: string;
  placeholder?: string;
  /** Show the format dropdown (default: false) */
  showFormatSwitch?: boolean;
  /** Initial format mode (default: "none") */
  formatMode?: FormatMode;
  /** Limit selectable modes (default: all) */
  formatModes?: FormatMode[];
  /** Bubble up mode changes (optional) */
  onFormatModeChange?: (m: FormatMode) => void;
}

const ALL_MODES: FormatMode[] = [
  "none",
  "upper",
  "lower",
  "title",
  "sentence",
  "numeric",
  "alphanumeric",
];

function toTitleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toSentenceCase(s: string) {
  const t = s.trim();
  if (!t) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function onlyDigits(s: string) {
  return s.replace(/\D+/g, "");
}

function onlyAlnumSpace(s: string) {
  return s.replace(/[^a-z0-9 ]/gi, "");
}

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

export function AutoFillField({
  label,
  field,
  endpoint,
  placeholder = "Search or enter...",
  showFormatSwitch = false,
  formatMode = "none",
  formatModes = ALL_MODES,
  onFormatModeChange,
}: AutoFillFieldProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useState<FormatMode>(formatMode);

  useEffect(() => setMode(formatMode), [formatMode]);

  useEffect(() => {
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => setOptions(Array.isArray(data) ? data : []))
      .catch(() => setOptions([]));
  }, [endpoint]);

  // Re-apply formatting when mode changes (so current value follows the new mode)
  useEffect(() => {
    const v = field.value ?? "";
    const next = applyFormat(v, mode);
    if (next !== v) field.onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleChange = (val: string) => {
    const next = applyFormat(val, mode);
    field.onChange(next);
    setIsOpen(false);
    setIsFocused(false);
  };

  // Build a view of options in the selected mode (but keep original as keys)
  const current = applyFormat(field.value ?? "", mode).toLowerCase();
  const viewOptions = options
    .map((raw) => ({ raw, view: applyFormat(String(raw), mode) }))
    // hide exact same as current (case-insensitive compare on view)
    .filter((o) => o.view.toLowerCase() !== current);

  const inputMode = mode === "numeric" ? "numeric" : undefined;

  return (
    <FormItem className="relative">
      <FormLabel className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {showFormatSwitch && (
          <div className="w-40">
            <Select
              value={mode}
              onValueChange={(m: FormatMode) => {
                setMode(m);
                onFormatModeChange?.(m);
              }}
            >
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
          className={`transition-all border rounded-md ${
            isFocused ? "border-blue-500 shadow-md" : "border-gray-300"
          }`}
        >
          <Command>
            <CommandInput
              inputMode={inputMode}
              placeholder={placeholder}
              value={applyFormat(field.value ?? "", mode)}
              onFocus={() => {
                setIsFocused(true);
                setIsOpen(true);
              }}
              onBlur={() => {
                // small delay to allow option click
                setTimeout(() => setIsFocused(false), 150);
              }}
              onValueChange={(val) => {
                // IMPORTANT: apply formatting per keystroke
                field.onChange(applyFormat(val, mode));
                setIsOpen(!!val || !(field.value ?? ""));
              }}
              className="px-1 py-1 outline-none w-full"
            />

            {isOpen && viewOptions.length > 0 && (
              <CommandGroup className="absolute top-20 left-0 w-full max-h-[200px] overflow-y-auto bg-white shadow-lg z-50 rounded-md">
                {viewOptions.map((o) => (
                  <CommandItem
                    key={o.raw}
                    onSelect={() => handleChange(o.raw)}
                    className="hover:bg-blue-100"
                  >
                    {o.view}
                  </CommandItem>
                ))}
                <CommandEmpty className="p-2 text-sm text-muted-foreground">
                  No matches
                </CommandEmpty>
              </CommandGroup>
            )}
          </Command>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
