// @ts-nocheck
"use client"
import { useRouter, useSearchParams } from "next/navigation";
import { Eligibility, EmployeeType } from "../../../types";
import qs from "query-string";
import { Separator } from "@/components/ui/separator";

import { cn } from "@/lib/utils";
import Button2 from "../../../components/ui/button";
import useLoadingStore from "@/hooks/use-loading";


interface FilterProps {
  data: (EmployeeType | Eligibility)[];
  name: string;
  valueKey: string;
  officeId: string;
  total: {
    id: string;
    count: {
      _all: number;
    };
  }[];

}

const Filter = ({
  data,
  name,
  valueKey,
  officeId,
  total

}: FilterProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const isLoading = useLoadingStore((state) => state.isLoading);
  const setLoading = useLoadingStore((state) => state.setLoading);

  const selectedValues = searchParams.getAll(valueKey);

  const onClick = (id: string) => {
     setLoading(true); 
    const current = qs.parse(searchParams.toString());

    let updatedValues;

    if (selectedValues.includes(id)) {
      // If the value is already selected, remove it
      updatedValues = selectedValues.filter(value => value !== id);
    } else {
      // If the value is not selected, add it
      updatedValues = [...selectedValues, id];
    }

    const query = {
      ...current,
      [valueKey]: updatedValues.length > 0 ? updatedValues : null,
    };

    const url = qs.stringifyUrl({
      url: window.location.href,
      query: {
        ...query,
        officeId,
      },
    }, { skipNull: true });

    router.push(url);
  }


  const countMap = total.reduce((acc, item) => {
    acc[item.id] = item.count._all;
    return acc;
  }, {} as { [key: string]: number });




  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold">
        {name}
      </h3>
      <Separator className="my-4" />
      <div className="flex flex-wrap gap-2">
        {data
          .filter(filter => countMap[filter.id] > 0) // Filter out items with count 0
          .map((filter) => (
            <div key={filter.id} className="flex items-center">
              <Button2
                onClick={() => onClick(filter.id)}
                disabled={isLoading}
                className={cn(
                  "rounded-md text-sm font-bold text-gray-800 p-2 bg-white border border-gray-300",
                  selectedValues.includes(filter.id) && "bg-black text-white",
                  isLoading  && "opacity-50 pointer-events-none cursor-not-allowed"
                )}
              >
                {filter.name} ({countMap[filter.id] || 0})
              </Button2>


            </div>
          ))}
      </div>
    </div>
  );
}

export default Filter;