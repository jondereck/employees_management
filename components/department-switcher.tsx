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
        <Button variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a department"
          className={cn("w-[250px] justify-between", className)}>
          <Building2 className="mr-2 h-4 w-4 " />
          {currentDepartment?.label}
          <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search Department..."/>
            <CommandEmpty>No department found.</CommandEmpty>
            <CommandGroup heading="departments">
              {formattedItems.map((department) => (
                <CommandItem
                key={department.value}
                onSelect={() => onDepartmentSelect(department)}
                className="text-sm"
                >
                  <Building className="mr-2 h-4 w-4"/>
                  {department.label}

                  <Check 
                    className={cn("ml-auto h-4 w-4 ",
                    currentDepartment?.value === department.value
                      ? "opacity-100"
                      : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator/>
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  departmentModal.onOpen()
                }}
              >
                <PlusCircle className="mr-2 h-5 w-5"/>
                Create Department
              </CommandItem>
            </CommandGroup>
          </CommandList>
          </Command>
      </PopoverContent>
    </Popover>
  );
}

