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
  field: any; // from react-hook-form
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

  useEffect(() => {
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => setOptions(data))
      .catch(() => setOptions([]));
  }, [endpoint]);

  const handleChange = (val: string) => {
    const formatted = uppercase ? val.toUpperCase() : val;
    field.onChange(formatted);
  };

    const filteredOptions = options.filter(
    (opt) =>
      (uppercase ? opt.toUpperCase() : opt) !== (field.value || "")
  );

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={field.value}
            onValueChange={handleChange}
          />
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-y-auto">
            {filteredOptions.map((opt) => (
              <CommandItem key={opt} onSelect={() => handleChange(opt)}>
                {uppercase ? opt.toUpperCase() : opt}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
