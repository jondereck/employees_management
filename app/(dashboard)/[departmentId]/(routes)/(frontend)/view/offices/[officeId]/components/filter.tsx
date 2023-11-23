"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Eligibility, EmployeeType } from "../../../types";
import qs from "query-string";
import { Separator } from "@/components/ui/separator";

import { cn } from "@/lib/utils";
import Button2 from "../../../components/ui/button";

interface FilterProps {
  data: (EmployeeType | Eligibility)[];
  name: string;
  valueKey: string;
}

const Filter = ({
  data,
  name,
  valueKey
}: FilterProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();


  const selectedValue = searchParams.get(valueKey);


  const onClick = (id: string) => {
    const current = qs.parse(searchParams.toString());

    const query = {
      ...current,
      [valueKey]: current[valueKey] === id ? null : id,
    };

    if (current[valueKey] === id ) {
      query[valueKey] = null;
    }

    const url = qs.stringifyUrl({
      url: window.location.href,
      query,
    }, { skipNull: true});

    router.push(url);
  }


  return (  
    <div className="mb-8">
      <h3 className="text-lg font-semibold">
        {name}
      </h3>
      <Separator className="my-4"/>
      <div className="flex flex-wrap gap-2">
        {data.map((filter) => (
          <div key={filter.id} className="flex items-center">
            <Button2
              onClick={() => onClick(filter.id)}
              className={cn("rounded-md text-sm font-bold text-gray-800 p-2 bg-white border border-gray-300", selectedValue === filter.id && "bg-black text-white")}
            >
              {filter.name}
            </Button2>
          </div>
        ))}
      </div>
   
    </div>
  );
}
 
export default Filter;