"use client";
import qs from "query-string";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEventHandler, useEffect, useState } from "react";
import { useDebounce } from "../hooks/use-debounce";

const SearchInput = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const officeId = searchParams.get("officeId")
  const lastName = searchParams.get("lastName");

  const [value, setValue] = useState(lastName || "");
  const debounceValue = useDebounce<string>(value, 500);

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setValue(event.target.value);
    
  }
  
  useEffect(() => {
    const query = {
      lastName: debounceValue,
      officeId: officeId,
    };

    const url = qs.stringifyUrl({
      url:window.location.href,
      query,
    },{ skipEmptyString: true, skipNull: true})

    console.log("New URL:", url);

     router.push(url);

  },[debounceValue, router, officeId])
  return (
    <div className="relative">
      <Search  className="absolute h-4 w-4 top-3 left-4 text-muted-foreground"/>
      <Input
        onChange={onChange}
        value={value}
        placeholder="Search..."
        className="pl-10 bg-primary/10"
      />
    </div>);
}

export default SearchInput;