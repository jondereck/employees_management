"use client"

import { Separator } from "@/components/ui/separator";
import { Employees } from "../../types";
import { useEffect, useState } from "react";
import { EmployeesColumn } from "../../../../employees/components/columns";




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
  return (
    <div className="bg-white p-6 rounded-lg shadow-md " style={{ border: `5px solid ${data?.employeeType?.value}` }}
    >
      <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">{fullName}</h1>
      <div className="flex flex-col items-start font-sans font-light justify-between mt-2">
        <p className="text-lg">{data.position}</p>
        <h3 className="text-sm font-light text-gray-700">({data?.offices?.name})</h3>
      </div>
      <Separator />
      <div className="flex flex-col mt-4">
    <p className="text-2xl font-bold border-b-2">Personal Details</p>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Gender:</h3>
      <p className="font-light">{data?.gender}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Contact Number:</h3>
      <p className="font-light">{formatContactNumber()}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Birthday:</h3>
      <p className="font-light">{formatBirthday()}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Age:</h3>
      {age !== null && <p className="font-light">{age} </p>}
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Appointment:</h3>
      <p className="font-light">{data?.employeeType?.name}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Eligibility:</h3>
      <p className="font-light">{data?.eligibility?.name}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Monthly Salary:</h3>
      <p className="font-light">{formatSalary()}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Annual Salary:</h3>
      <p className="font-light">{calculateAnnualSalary()}</p>
    </div>
    <Separator />
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">GSIS Number:</h3>
      <p className="font-light">{data?.gsisNo}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">TIN Number:</h3>
      <p className="font-light">{data?.tinNo}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Philhealth Number:</h3>
      <p className="font-light">{data?.philHealthNo}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Date Hired:</h3>
      <p className="font-light">{formatDateHired()}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Year of Service:</h3>
      {yearService && (
        <p className="font-light items-start">
          {yearService.years} Y/s, {yearService.months} Mon/s, {yearService.days} Day/s
        </p>
      )}
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">Latest Appointment:</h3>
      <p className="font-light">{formatLatestAppointment()}</p>
    </div>
    <div className="flex flex-col lg:flex-row ">
      <h3 className="font-semibold lg:mr-2">YoS latest appoint:</h3>
      {latestAppointDate && (
        <p className="font-light items-start">
          {latestAppointDate.years} Y/s, {latestAppointDate.months} Mon/s, {latestAppointDate.days} Day/s
        </p>
      )}
    </div>
  </div>

    </div>);
}

export default Info;