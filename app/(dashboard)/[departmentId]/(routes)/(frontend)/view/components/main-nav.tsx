"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { cn } from "../lib/utils";
import { Offices } from "../types";
import {
  Building,
  Check,
  ChevronsUpDownIcon,
  PlusCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import useLoadingStore from "@/hooks/use-loading";

type PopoverTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverTrigger
>;

interface MainNav extends PopoverTriggerProps {
  data: Offices[];
}

const MainNav = ({ data, className }: MainNav) => {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  const setLoading = useLoadingStore((state) => state.setLoading); // optional shared loading state
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const formattedItems = data.map((item) => ({
    label: item.name,
    value: item.id,
  }));

  const currentDepartment =
    formattedItems.find((item) => item.value === params.officeId) || {
      value: `/${process.env.HOMEPAGE}/view`,
      label: "Select Office",
    };

  const sortedItems = formattedItems.slice().sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  const onDepartmentSelect = async (department: {
    value: string;
    label: string;
  }) => {
    setIsLoading(true);      // disable dropdown temporarily
    setLoading(true);        // optional shared loading state

    router.push(`/${params.departmentId}/view/offices/${department.value}`);

    // Let Next.js trigger the global loader via app/loading.tsx
  };

  return (
    <nav className="mx-6 flex items-center space-x-4 lg:space-x-6">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            disabled={isLoading}
            aria-label="Select a department"
            className={cn(
              "w-[200px] lg:w-[250px] justify-between",
              className
            )}
          >
            <Building className="mr-2 h-4 w-4" />
            {currentDepartment.label}
            <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search Office..." />
              <CommandEmpty>No office(s) found.</CommandEmpty>
              <CommandGroup heading="Offices">
                {sortedItems.map((department) => (
                  <CommandItem
                    key={department.value}
                    onSelect={() => onDepartmentSelect(department)}
                    className="text-sm"
                  >
                    <Building className="mr-2 h-4 w-4" />
                    {department.label}
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

            <CommandSeparator />

            <CommandList>
              <CommandGroup>
                <Button
                  variant="ghost"
                  onClick={() =>
                    router.push(`/${params.departmentId}/offices/new`)
                  }
                >
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Office
                </Button>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </nav>
  );
};

export default MainNav;
