'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Building,
  Check,
  ChevronsUpDownIcon,
  PlusCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Offices } from '../types';
import { getRecentOffices, updateRecentOffices } from '@/utils/recent-offices';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import useLoadingStore from '@/hooks/use-loading';
import { getFavoriteOffices, toggleFavoriteOffice } from "@/utils/favorite-office";
import { Star, StarOff } from "lucide-react"; // or use just Star with fill

type MainNavProps = {
  data: Offices[];
  className?: string;
};

const MainNav = ({ data, className }: MainNavProps) => {
  const router = useRouter();
  const params = useParams();
  const setLoading = useLoadingStore((state) => state.setLoading);

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);


  useEffect(() => {
    setRecentIds(getRecentOffices());
  }, []);

  useEffect(() => {
    setFavorites(getFavoriteOffices());
  }, [])

  const formattedItems = useMemo(() => {
    return data.map((item) => ({
      label: item.name,
      value: item.id,
    }));
  }, [data]);

  const recentItems = useMemo(() => {
    return recentIds
      .map((id) => formattedItems.find((o) => o.value === id))
      .filter(Boolean) as { label: string; value: string }[];
  }, [formattedItems, recentIds]);

  const otherItems = useMemo(() => {
    return formattedItems
      .filter((item) => !recentIds.includes(item.value))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [formattedItems, recentIds]);

  const currentDepartment = formattedItems.find((item) => item.value === params.officeId) || {
    label: 'Select Office',
    value: '',
  };

  const favoriteItems = useMemo(() => {
    return favorites
      .map((id) => formattedItems.find((o) => o.value === id))
      .filter((o): o is { label: string; value: string } => !!o);
  }, [formattedItems, favorites]);


  const onDepartmentSelect = async (office: { label: string; value: string }) => {
    if (office.value === params.officeId) return;

    setIsLoading(true);
    setLoading(true);
    updateRecentOffices(office.value);
    router.push(`/${params.departmentId}/view/offices/${office.value}`);
  };

  return (
    <nav className="mx-6 flex items-center space-x-4 lg:space-x-6">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-11 w-full sm:w-[400px] px-4 text-base justify-between"
          >
            <Building className="mr-2 h-5 w-5 shrink-0" />

            <span className="truncate text-left max-w-[200px] sm:max-w-[400px]">
              {currentDepartment.label}
            </span>

            <ChevronsUpDownIcon className="ml-auto h-5 w-5 shrink-0 opacity-50" />
          </Button>

        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-screen max-w-sm sm:max-w-md lg:w-[400px] p-0 z-50"

        >

          <Command>
            <CommandInput placeholder="Search offices..." />
            <CommandEmpty>No office found.</CommandEmpty>
            <div className="max-h-[300px] overflow-y-auto">
              {favoriteItems.length > 0 && (
                <CommandGroup heading="Favorites">
                  {favoriteItems.map((office) => (
                    <CommandItem key={office.value} onSelect={() => onDepartmentSelect(office)}>
                      <Building className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate max-w-[285px]">{office.label}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // stop dropdown from closing
                          toggleFavoriteOffice(office.value);
                          setFavorites(getFavoriteOffices());
                        }}
                        className={cn(
                          "ml-auto mr-2 w-5 h-5 transition-all duration-200 ease-in-out",
                          favorites.includes(office.value) ? "text-yellow-500" : "text-muted-foreground"
                        )}

                        title={favorites.includes(office.value) ? "Unpin" : "Pin"}
                      >
                        <Star
                          className="w-4 h-4"
                          fill={favorites.includes(office.value) ? "currentColor" : "none"}
                        />
                      </button>

                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          currentDepartment.value === office.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {recentItems.length > 0 && (

                <CommandGroup heading="Recent">
                  {recentItems.map((office) => (
                    <CommandItem
                      key={office.value}
                      onSelect={() => onDepartmentSelect(office)}
                      className="text-sm"
                    >
                      <Clock className="mr-2 h-4 w-4 flex-shrink-0 only:text-muted-foreground" />
                      <span className="truncate">{office.label}</span>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4',
                          currentDepartment.value === office.value
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading="All Offices">
                {otherItems.map((office) => (
                  <CommandItem key={office.value} onSelect={() => onDepartmentSelect(office)}>
                    <Building className="mr-2 h-4 w-4 shrink-0" />

                    <span className="truncate max-w-[280px]">{office.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent dropdown from closing
                        toggleFavoriteOffice(office.value);
                        setFavorites(getFavoriteOffices());
                      }}
                      title={favorites.includes(office.value) ? "Unpin" : "Pin"}
                      className={cn(
                        "ml-auto mr-2 w-5 h-5 transition-all duration-200 ease-in-out",
                        favorites.includes(office.value) ? "text-yellow-500" : "text-muted-foreground"
                      )}
                    >
                      <Star
                        className="w-4 h-4"
                        fill={favorites.includes(office.value) ? "currentColor" : "none"}
                      />
                    </button>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        currentDepartment.value === office.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>

                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup>
                <CommandItem
                  onSelect={() => router.push(`/${params.departmentId}/offices/new`)}
                >
                  <PlusCircle className="mr-2 h-4 w-4 text-primary" />
                  Create Office
                </CommandItem>
              </CommandGroup>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </nav>
  );
};

export default MainNav;
