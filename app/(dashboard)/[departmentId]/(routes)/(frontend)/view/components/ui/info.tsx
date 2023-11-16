"use client"

import { Separator } from "@/components/ui/separator";
import { Employees } from "../../types";
import { useEffect, useState } from "react";




interface InfoProps {
  data: Employees;
}

const Info = ({
  data,
}: InfoProps) => {

  const [age, setAge ] = useState<number | null>(null);

  useEffect(() => {
    // Calculate age when component mounts or when data.birthday changes
    calculateAge();
  },[data.birthday])

  const calculateAge = () => {
    const birthdate = new Date(data.birthday);
    const currentDate = new Date();

    let ageDiff = currentDate.getFullYear() - birthdate.getFullYear();

   // Check if the birthday for this year has already occurred
   const hasBirthdayOccurred =
   currentDate.getMonth() > birthdate.getMonth() ||
   (currentDate.getMonth() === birthdate.getMonth() &&
     currentDate.getDate() >= birthdate.getDate());

      // Adjust age if the birthday hasn't occurred yet this year
      if (!hasBirthdayOccurred) {
        ageDiff -= 0;
      }

    setAge(ageDiff);

  }


  const fullName = `${data.firstName.toUpperCase()} ${data.middleName.toUpperCase()} ${data.lastName.toUpperCase()}`;
  return (
  <div>
    <h1 className="text-3xl font-semibold text-gray-900">{fullName}
    </h1>
    <div className="mt-3 flex items-end font-sans font-light justify-between">
      <p>{data.position}</p>
    </div>
    <Separator/>
  </div>);
}

export default Info;