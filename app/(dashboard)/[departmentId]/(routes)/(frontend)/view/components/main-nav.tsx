"use client"

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { cn } from "../lib/utils";
import { Offices } from "../types";
import { Building, Building2, Check, ChevronsUpDownIcon, PlusCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator  } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import useSearchModal from "@/hooks/user-search-modal";
import { useState } from "react";

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger>




interface MainNav extends PopoverTriggerProps{
  data: Offices[];
  
}

const MainNav = ({
  data,
  className,
}: MainNav) => {
  const pathname = usePathname();
  const params = useParams();
  const searchModal = useSearchModal();
  const router = useRouter();

  const formattedItems = data.map((item) => ({
    label: item.name,
    value: item.id
  }));




  const currentDepartment = formattedItems.find((item) => item.value === params.officeId);

  const [open, setOpen] = useState(false);

  const onDepartmentSelect = (department: { value: string, label: string }) => {
    setOpen(false);
    router.push(`/${params.departmentId}/view/offices/${department.value}`);
  }
  
  // const routes = data.map((route) => ({
  //   href: `/${params.departmentId}/view/offices/${route.id}`,
  //   label: route.name,
  //   active: pathname  === `/${params.departmentId}/view/offices/${route.id}`
  // }))

  return (
    <nav className="mx-6 flex items-center  space-x-4 lg:space-x-6">
      {/* {routes.map((route) => (
        <Link
        key={route.href}
        href={route.href}
        className={cn("text-sm font-medium transition-colors hover:text-black", route.active ? "text-black" : "text-neutral-500")}
      >
        {route.label}
      </Link>
      ))} */}
 <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline"
          size="sm"
          placeholder="of"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a department"
          className={cn("w-[200px] lg:w-[250px] justify-between", className)}>
          
          <Building className="mr-2 h-4 w-4 " />
          {currentDepartment?.label}
          Select Office
          <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search Office..."/>
            <CommandEmpty>No office(s) found.</CommandEmpty>
            <CommandGroup heading="Offices">
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
                onClick={() => router.push(`/${params.departmentId}/offices`)}
              >
                <PlusCircle className="mr-2 h-5 w-5"/>
                Create Office
              </CommandItem>
            </CommandGroup>
          </CommandList>
          </Command>
      </PopoverContent>
    </Popover>

    </nav>
  );
}

export default MainNav;