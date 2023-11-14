"use client"

import Image from "next/image";
import { Employees } from "../../types";

interface EmployeeCardProps {
  data: Employees;
}

const EmployeeCard = ({
  data,
}: EmployeeCardProps) => {
  return ( 
  <div className="bg-white group cursor-pointer rounded-xl border p-3 space-y-4">
    <div className="aspect-square rounded-xl bg-gray-100 relative">
      <Image 
        src={data?.images?.[0]?.url}
        fill
        alt="Image"
      />
    </div>
  </div> );
}
 
export default EmployeeCard;