"use client";

import { Department } from "@prisma/client";

import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import useStoreModal from "@/hooks/use-store-modal";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { Building, Building2, Check, ChevronsUpDownIcon, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "./ui/command";


type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger>

interface DepartmentSwitcherProps extends PopoverTriggerProps {
  items: Department[];
};

export default function DepartmentSwitcher({
  className,
  items = []
}: DepartmentSwitcherProps) {
  const departmentModal = useStoreModal();
  const params = useParams();
  const router = useRouter();

  const formattedItems = items.map((item) => ({
    label: item.name,
    value: item.id
  }));

  const currentDepartment = formattedItems.find((item) => item.value === params.departmentId);

  const [open, setOpen] = useState(false);

  const onDepartmentSelect = (department: { value: string, label: string }) => {
    setOpen(false);
    router.push(`/${department.value}`);
  }

  return (
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      role="combobox"
      aria-expanded={open}
      aria-label="Select a department"
      className={cn(
        "w-[250px] justify-between rounded-xl border-white/40 bg-white/30 backdrop-blur-md transition-all hover:bg-white/50 hover:shadow-lg focus:ring-2 focus:ring-blue-400/50",
        className
      )}
    >
      <div className="flex items-center text-slate-700 font-bold tracking-tight">
        <Building2 className="mr-2 h-4 w-4 text-blue-500" />
        <span className="truncate">{currentDepartment?.label || "Select Institution"}</span>
      </div>
      <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  
  <PopoverContent 
    className="w-[250px] p-0 border-white/40 bg-white/70 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden"
    align="start"
  >
    <Command className="bg-transparent">
      <CommandList className="max-h-[300px]">
        <div className="flex items-center border-b border-slate-200/50 px-3">
          <CommandInput 
            placeholder="Search Institution..." 
            className="border-none focus:ring-0 placeholder:text-slate-400 text-sm h-11"
          />
        </div>
        <CommandEmpty className="py-6 text-center text-xs text-slate-500 font-medium">
          No government institution found.
        </CommandEmpty>
        
        <CommandGroup heading={<span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Departments</span>}>
          {formattedItems.map((department) => (
            <CommandItem
              key={department.value}
              onSelect={() => onDepartmentSelect(department)}
              className="mx-1 my-0.5 rounded-lg py-2 px-3 text-sm font-semibold text-slate-700 transition-colors aria-selected:bg-blue-500 aria-selected:text-white group"
            >
              <Building className="mr-2 h-4 w-4 text-slate-400 group-aria-selected:text-blue-100" />
              <span className="truncate">{department.label}</span>

              <Check
                className={cn(
                  "ml-auto h-4 w-4",
                  currentDepartment?.value === department.value
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      
      <CommandSeparator className="bg-slate-200/50" />
      
      <CommandList>
        <CommandGroup>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              departmentModal.onOpen();
            }}
            className="mx-1 my-1 rounded-lg py-2.5 px-3 text-sm font-bold text-blue-600 transition-colors aria-selected:bg-blue-600 aria-selected:text-white"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Create Institution
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
  );
}

