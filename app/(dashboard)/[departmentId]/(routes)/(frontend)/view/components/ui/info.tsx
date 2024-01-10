"use client"

import { Separator } from "@/components/ui/separator";
import { Employees } from "../../types";
import { useEffect, useState } from "react";
import { EmployeesColumn } from "../../../../employees/components/columns";
import IconButton from "./icon-button";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { ActionTooltip } from "@/components/ui/action-tooltip";




interface InfoProps {
  data: EmployeesColumn;
}

const Info = ({
  data,
}: InfoProps) => {

  const [age, setAge] = useState<number | null>(null);
  const [yearService, setYearService] = useState<{ years: number; months: number; days: number; } | null>(null);
  const [latestAppointDate, setLatestAppointDate] = useState<{ years: number; months: number; days: number; } | null>(null);




  useEffect(() => {
    console.log("Data changed:", data);
    // Calculate age when component mounts or when data.birthday changes
    calculateAge();
    calculateYearService();
    calculateYearServiceLatestAppointment();
  }, [data.birthday, data.dateHired, data.latestAppointment],)

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
      ageDiff -= 1;
    }

    setAge(ageDiff);

  }




  const formatBirthday = () => {
    console.log("Formatting birthday...");
    const birthdate = new Date(data.birthday);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: '2-digit'
    };

    return birthdate.toLocaleDateString('en-US', options);
  }

  const calculateYearService = () => {
    const dateHired = new Date(data.dateHired);
    const currentDate = new Date();

    let serviceYears = currentDate.getFullYear() - dateHired.getFullYear();
    let serviceMonths = currentDate.getMonth() - dateHired.getMonth();
    let serviceDays = currentDate.getDate() - dateHired.getDate();

    // Adjust service years, months, and days if the hiring date hasn't occurred yet this year
    if (currentDate.getMonth() < dateHired.getMonth() ||
      (currentDate.getMonth() === dateHired.getMonth() && currentDate.getDate() < dateHired.getDate())) {
      serviceYears -= 1;

      // Adjust months for the case where the current month is before the hiring month
      serviceMonths = (12 + currentDate.getMonth()) - dateHired.getMonth();
    }

    // Ensure positive values for months and days
    if (serviceMonths < 0) {
      serviceMonths += 12;
    }

    if (serviceDays < 0) {
      serviceDays += new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    }

    setYearService({
      years: serviceYears,
      months: serviceMonths,
      days: serviceDays
    });
  };


  const calculateYearServiceLatestAppointment = () => {
    const latestAppointment = new Date(data.latestAppointment);
    const currentDate = new Date();

    let serviceYears = currentDate.getFullYear() - latestAppointment.getFullYear();
    let serviceMonths = currentDate.getMonth() - latestAppointment.getMonth();
    let serviceDays = currentDate.getDate() - latestAppointment.getDate();

    // Adjust service years, months, and days if the hiring date hasn't occurred yet this year
    if (currentDate.getMonth() < latestAppointment.getMonth() ||
      (currentDate.getMonth() === latestAppointment.getMonth() && currentDate.getDate() < latestAppointment.getDate())) {
      serviceYears -= 1;

      // Adjust months for the case where the current month is before the hiring month
      serviceMonths = (12 + currentDate.getMonth()) - latestAppointment.getMonth();
    }

    // Ensure positive values for months and days
    if (serviceMonths < 0) {
      serviceMonths += 12;
    }

    if (serviceDays < 0) {
      serviceDays += new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    }

    setLatestAppointDate({
      years: serviceYears,
      months: serviceMonths,
      days: serviceDays
    });
  };


  const formatDateHired = () => {
    const dateHired = new Date(data.dateHired);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: '2-digit'
    };

    return dateHired.toLocaleDateString('en-US', options);
  }



  const formatLatestAppointment = () => {
    const latestAppointment = new Date(data.latestAppointment);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: '2-digit'
    };

    return latestAppointment.toLocaleDateString('en-US', options);
  }

  const formatContactNumber = () => {
    const rawNumber = data?.contactNumber || '';

    // If rawNumber is empty, return an empty string
    if (!rawNumber.trim()) {
      return 'No data';
    }

    const numericOnly = rawNumber.replace(/\D/g, ''); // Remove non-numeric characters

    // Remove '+63' or '63' from the beginning
    const formattedNumber = numericOnly.replace(/^(\+63|63)/, '');

    // Add a leading '0' if it's missing
    const finalNumber = formattedNumber.startsWith('0') ? formattedNumber : `0${formattedNumber}`;

    // Format the number with spaces
    const formattedWithSpaces = `${finalNumber.slice(0, 4)}-${finalNumber.slice(4, 7)}-${finalNumber.slice(7)}`;

    return formattedWithSpaces;
  };







  const formatSalary = () => {
    const salary = parseFloat(data.salary);
    if (isNaN(salary)) {
      // Handle the case where the conversion to a number fails
      return 'Invalid Salary';
    }
    const formattedSalary = new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(salary);

    return `${formattedSalary}`

  }

  const calculateAnnualSalary = () => {
    const monthlySalary = parseFloat(data.salary);
    if (isNaN(monthlySalary)) {
      // Handle the case where the conversion to a number fails
      return 'Invalid Salary';
    }

    const annualSalary = monthlySalary * 12
    const formattedSalary = new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(annualSalary);

    return `${formattedSalary}`

  }

  const fullName = `${data.firstName.toUpperCase()} ${data.middleName.toUpperCase()} ${data.lastName.toUpperCase()} ${data.suffix.toUpperCase()}`;

  const addressFormat = (data:any) => {
    const { region, barangay, city, province, houseNo } = data;
  
    // Create an array of non-empty address components
    const addressComponents = [region, houseNo, barangay, city, province ].filter(Boolean);
  
    // Convert the array elements to camel case
    const formattedAddress = addressComponents.map(component => 
      component.replace(/\w\S*/g, (word:string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    );
  
    // Join the formatted components with a comma and space
    return formattedAddress.join(', ') || 'No data';
  };
  
  return (
    
    <div className="bg-white p-6 rounded-lg shadow-md " style={{ border: `10px solid ${data?.employeeType?.value}` }}
    ><Separator />
      <h1 className=" flex items-justify text-3xl lg:text-4xl font-bold text-gray-900 gap-2">{fullName}
        <ActionTooltip
          label="Executive Level"
          side="left"
        >
          <div>
            {data.isHead && <IconButton icon={<StarFilledIcon className="text-yellow-600 " />}
            />}
          </div>

        </ActionTooltip>
      </h1>
      <div className="flex flex-col items-start font-sans font-light justify-between">
        <p className="text-lg font-semibold">{data.position}</p>
        <h3 className="text-sm font-light text-gray-700">({data?.offices?.name})</h3>
      </div>
      <Separator />
      <div className="flex flex-col mt-4">
        <p className="text-xl lg:text-2xl  font-semibold ">Personal Details</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Gender</h3>
          <p className="font-light text-sm md:text-xl lg:text-2xl">{data?.gender}</p>
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Contact Number</h3>
          <p className="font-light text-sm lg:text-2xl">{formatContactNumber()}</p>
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl ">Birthday</h3>
          <p className="font-light text-sm lg:text-2xl">{formatBirthday()}</p>
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Age</h3>
          {age !== null && <p className="font-light text-sm lg:text-2xl">{age} </p>}
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Appointment</h3>
          <p className="font-light text-sm lg:text-2xl">{data?.employeeType?.name}</p>
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Eligibility</h3>
          <p className="font-light text-sm lg:text-2xl">{data?.eligibility?.name}</p>
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Monthly Salary</h3>
          <p className="font-light text-sm lg:text-2xl">{formatSalary()}</p>
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Annual Salary</h3>
          <p className="font-light text-sm lg:text-2xl">{calculateAnnualSalary()}</p>
        </div>
        <div className="flex flex-col ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Address</h3>
          <p className="font-light text-sm lg:text-2xl">{addressFormat(data)}</p>
        </div>
        <div>
          
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">GSIS Number</h3>
          <p className="font-light text-sm lg:text-2xl">{data?.gsisNo || 'No Data'}</p>
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">TIN Number</h3>
          <p className="font-light text-sm lg:text-2xl">{data?.tinNo  || 'No Data'}</p>
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Pagibig Number</h3>
          <p className="font-light text-sm lg:text-2xl">{data?.pagIbigNo  || 'No Data'}</p>
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Philhealth Number</h3>
          <p className="font-light text-sm lg:text-2xl">{data?.philHealthNo  || 'No Data'}</p>
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Date Hired</h3>
          <p className="font-light text-sm lg:text-2xl">{formatDateHired()}</p>
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Year of Service</h3>
          {yearService && (
            <p className="font-light text-sm lg:text-2xl items-start">
              {yearService.years} Y/s, {yearService.months} Mon/s, {yearService.days} Day/s
            </p>
          )}
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Latest Appointment</h3>
          <p className="font-light text-sm lg:text-2xl">{formatLatestAppointment()}</p>
        </div>
        <div className="flex flex-col  ">
          <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">YoS latest appoint</h3>
          {latestAppointDate && (
            <p className="font-light text-sm lg:text-2xl items-start">
              {latestAppointDate.years} Y/s, {latestAppointDate.months} Mon/s, {latestAppointDate.days} Day/s
            </p>
          )}
        </div>
        </div>
      </div>

    </div>);
}

export default Info;