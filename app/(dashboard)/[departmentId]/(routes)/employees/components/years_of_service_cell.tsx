import React from "react";
import { parse } from "date-fns"

interface YearsOfServiceProps {
  year_service: string;
}

const YearsOfService: React.FC<YearsOfServiceProps> = ({ year_service }) => {
  const calculateService = (birthdate: string) => {
    // Parse the birthdate using date-fns parse function
    const parsedBirthdate = parse(birthdate, 'M d, yyyy', new Date());
  
    if (isNaN(parsedBirthdate.getTime())) {
      console.log("Invalid YOS:", birthdate);
      return null;
    }
  
    const today = new Date();
  
    const yos = today.getFullYear() - parsedBirthdate.getFullYear();
    const monthDiff = today.getMonth() - parsedBirthdate.getMonth();
  
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsedBirthdate.getDate())) {
      return yos - 1;
    }
  
    return yos;
  };

  const yos = calculateService(year_service);

  return <span>{yos}</span>;
};

export default YearsOfService;
