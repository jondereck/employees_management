"use client";

import { useState, useEffect } from "react";
import {
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface AutoFillFieldProps {
  label: string;
  field: any; // react-hook-form field
  endpoint: string;
  placeholder?: string;
  uppercase?: boolean;
}

export function AutoFillField({
  label,
  field,
  endpoint,
  placeholder = "Search or enter...",
  uppercase = false,
}: AutoFillFieldProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => setOptions(data))
      .catch(() => setOptions([]));
  }, [endpoint]);

  const handleChange = (val: string) => {
    const formatted = uppercase ? val.toUpperCase() : val;
    field.onChange(formatted);
    setIsOpen(false);
    setIsFocused(false);
  };

  const filteredOptions = options.filter(
    (opt) => (uppercase ? opt.toUpperCase() : opt) !== (field.value || "")
  );

  return (
    <FormItem className="relative">
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div
          className={`transition-all border rounded-md ${
            isFocused ? "border-blue-500 shadow-md" : "border-gray-300"
          }`}
        >
          <Command>
            <CommandInput
              placeholder={placeholder}
              value={field.value}
              onFocus={() => {
                setIsFocused(true);
                setIsOpen(true);
              }}
              onBlur={() => {
                // small delay to allow option click
                setTimeout(() => setIsFocused(false), 150);
              }}
              onValueChange={(val) => {
                field.onChange(uppercase ? val.toUpperCase() : val);
                setIsOpen(!!val || !field.value);
              }}
              className="px-1 py-1 outline-none w-full"
            />

            {/* Show options only if open and there are filtered options */}
            {isOpen && filteredOptions.length > 0 && (
              <CommandGroup
                className="absolute top-20 left-0 w-full max-h-[200px] overflow-y-auto bg-white shadow-lg z-50 rounded-md"
              >
                {filteredOptions.map((opt) => (
                  <CommandItem
                    key={opt}
                    onSelect={() => handleChange(opt)}
                    className="hover:bg-blue-100"
                  >
                    {uppercase ? opt.toUpperCase() : opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

      
          </Command>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
