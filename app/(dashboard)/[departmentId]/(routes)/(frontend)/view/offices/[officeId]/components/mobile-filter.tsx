"use client";

import { useState } from "react";
import { Eligibility, EmployeeType } from "../../../types";
import Button2 from "../../../components/ui/button";
import { Plus } from "lucide-react";
import Filter from "./filter";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator";






interface MobileFilterProps {
  employeeType: EmployeeType[];
  eligibility: Eligibility[];
  officeId: string
  total: {
    id: string;
    count: {
      _all: number;
    };
  }[];
}


const MobileFilter = ({
  employeeType,
  eligibility,
  officeId,
  total
}: MobileFilterProps) => {



  return (
    <div className="lg:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button2
            className="flex items-center gap-x-2 lg:hidden"

          >
            Filter
            <Plus size={20} />
          </Button2></SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-2xl ">Filters</SheetTitle>
            <Separator className="h-2" />

          </SheetHeader>
          <Filter
            total={total}
            officeId={officeId}
            valueKey="employeeTypeId"
            name="Appointment"
            data={employeeType}
          />
          <Filter
          total={total}
            officeId={officeId}
            valueKey="employeeTypeId"
            name="Eligibility"
            data={eligibility}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default MobileFilter;