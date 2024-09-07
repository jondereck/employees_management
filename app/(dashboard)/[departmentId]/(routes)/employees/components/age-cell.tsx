import React from "react";
import { parse } from "date-fns"

interface AgeCellProps {
  birthday: string;
}

const AgeCell: React.FC<AgeCellProps> = ({ birthday }) => {
  const calculateAge = (birthdate: string) => {
    // Parse the birthdate using date-fns parse function
    const parsedBirthdate = parse(birthdate, 'M d, yyyy', new Date());
  
    if (isNaN(parsedBirthdate.getTime())) {
      console.log("Invalid birthdate:", birthdate);
      return null;
    }
  
    const today = new Date();
  
    const age = today.getFullYear() - parsedBirthdate.getFullYear();
    const monthDiff = today.getMonth() - parsedBirthdate.getMonth();
  
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsedBirthdate.getDate())) {
      return age - 1;
    }
  
    return age;
  };

  const age = calculateAge(birthday);

  return <span>{age}</span>;
};

export default AgeCell;
