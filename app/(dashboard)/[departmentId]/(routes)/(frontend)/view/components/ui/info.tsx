"use client"

import { Separator } from "@/components/ui/separator";
import { Employees } from "../../types";
import IconButton from "./icon-button";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FolderMinus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  calculateAnnualSalary,
  formatContactNumber,
  formatSalary,
  calculateYearService,
  calculateYearServiceLatestAppointment,
  formatLatestAppointment,
  formatTerminateDate, calculateAge,
  addressFormat,
  formatDate,
  formatPagIbigNumber,
  formatPhilHealthNumber,
  formatGsisNumber
} from "../../../../../../../../utils/utils";
import { EmployeesColumn } from "../../../../employees/components/columns";




interface InfoProps {
  data: Employees | EmployeesColumn;
}

const Info = ({
  data,
}: InfoProps) => {

  const formattedSalary = formatSalary(data.salary);
  const annualSalary = calculateAnnualSalary(data.salary);
  const formattedContactNumber = formatContactNumber(data.contactNumber);
  const formattedAddress = addressFormat(data);

  // Calculate years of service
  const yearService = calculateYearService(data.dateHired, data.terminateDate);

  // Calculate years of service since latest appointment
  const latestAppointmentService = calculateYearServiceLatestAppointment(data.latestAppointment);

  // Format dates
  const formattedDateHired = formatDate(data.dateHired);
  const formattedLatestAppointment = formatLatestAppointment(data.latestAppointment);
  const formattedTerminateDate = formatTerminateDate(data.terminateDate);
  const calculatedAge = calculateAge(data.birthday);
  const formattedBirthday = formatDate(data.birthday);


  const fullName = `${data.prefix} ${data.firstName.toUpperCase()} ${data.nickname ? `"${data.nickname}"` : ""} ${data.middleName.length === 1 ? data.middleName.toUpperCase() + '.' : data.middleName.toUpperCase()} ${data.lastName.toUpperCase()} ${data.suffix.toUpperCase()}`;

  return (

    <div className="bg-white p-6 rounded-lg shadow-md " style={{ border: `10px solid ${data?.employeeType?.value}` }}
    ><Separator />
      <h1 className=" flex items-justify text-3xl lg:text-4xl font-bold text-gray-900 gap-2">{fullName}
        <ActionTooltip
          label="Executive Level"
          side="left"
        >
          <div className="pt-1">
            {data.isHead && <IconButton icon={<StarFilledIcon className="text-yellow-600 " />}
            />}
          </div>

        </ActionTooltip>
      </h1>

      <div className="flex flex-col items-start font-sans font-light justify-between">
        <div className="flex justify-center items-center gap-2">
          <p className="text-lg font-semibold">{data.position} </p>
          {data.salaryGrade ? <p className="text-xs">{`S.G. ${data.salaryGrade}`}</p> : null}
        </div>
      </div>
      <h3 className="text-sm font-light text-gray-700">({data?.offices?.name})</h3>
      <div className="flex items-center justify-between my-2">

        {data.employeeLink && (
          <Button
            onClick={() => window.open(data?.employeeLink, '_blank')}
            variant="outline"
            className=" text-white font-bold p-2 rounded flex items-center group"
            style={{ backgroundColor: data.employeeType.value }}

          >
            <div className="relative flex items-center md:mr-7 mr-7">
              {/* The ArchiveRestore icon */}
              <FolderMinus className="absolute transition-opacity duration-300 ease-in-out group-hover:opacity-0" />
              {/* The PackageOpen icon */}
              <FolderOpen className="absolute transition-opacity duration-300 ease-in-out opacity-0 group-hover:opacity-100" />
            </div>
            <p className="text-sm sm:text-base md:text-lg leading-tight">
              Employee Files
            </p>

          </Button>
        )}
      </div>


      <Separator />
      <div className="flex flex-col mt-4">
        <p className="text-xl lg:text-3xl  font-semibold ">Personal Details</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="flex flex-col ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Gender</h3>
            <p className="font-light text-sm lg:text-2xl">{data?.gender}</p>
          </div>
          <div className="flex flex-col ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Contact Number</h3>
            <p className="font-light text-sm lg:text-2xl">{formattedContactNumber}</p>
          </div>
          <div className="flex flex-col ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl ">Birthday</h3>
            <p className="font-light text-sm lg:text-2xl">{formattedBirthday}</p>
          </div>
          <div className="flex flex-col ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Age</h3>
            <p className="font-light text-sm lg:text-2xl">{calculatedAge} </p>
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
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl"> Highest Educational Attaintment </h3>
            <p className="font-light text-sm lg:text-2xl">{data?.education || "No Data"}</p>
          </div>
          <div className="flex flex-col ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Address</h3>
            <p className="font-light text-sm lg:text-2xl">{formattedAddress}</p>
          </div>
          <div className="flex flex-col ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Monthly Salary</h3>
            <p className="font-light text-sm lg:text-2xl"> {formattedSalary}</p>
          </div>
          <div className="flex flex-col ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Annual Salary</h3>
            <p className="font-light text-sm lg:text-2xl">{annualSalary}</p>
          </div>
          <div className="flex flex-col  ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">GSIS #</h3>
            <p className="font-light text-sm lg:text-2xl">{formatGsisNumber(data?.gsisNo)}</p>
          </div>
          <div className="flex flex-col  ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">TIN #</h3>
            <p className="font-light text-sm lg:text-2xl">{data?.tinNo || 'No Data'}</p>
          </div>
          <div className="flex flex-col  ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Pagibig #</h3>
            <p className="font-light text-sm lg:text-2xl">{formatPagIbigNumber(data?.pagIbigNo)}</p>
          </div>
          <div className="flex flex-col  ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Member Policy #</h3>
            <p className="font-light text-sm lg:text-2xl">{data?.memberPolicyNo || 'No Data'}</p>
          </div>
          <div className="flex flex-col  ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Philhealth #</h3>
            <p className="font-light text-sm lg:text-2xl">{formatPhilHealthNumber(data?.philHealthNo)}</p>
          </div>
          <br />
          <div className="flex flex-col  ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Date Hired</h3>
            <p className="font-light text-sm lg:text-2xl">{formattedDateHired}</p>
          </div>

          <div className="flex flex-col  ">
            <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl"> Service Rendered</h3>
            {yearService && (
              <p className="font-light text-sm lg:text-2xl items-start">
                {yearService.years} Y/s, {yearService.months} Mon/s, {yearService.days} Day/s
              </p>
            )}
          </div>
          {data.latestAppointment && (
            <div className="flex flex-col">
              <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Latest Appointment</h3>
              <p className="font-light text-sm lg:text-2xl">{formattedLatestAppointment}</p>
            </div>
          )}

          {data.latestAppointment && (
            <div className="flex flex-col">
              <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">YoS latest appoint</h3>
              {latestAppointmentService && (
                <p className="font-light text-sm lg:text-2xl items-start">
                  {latestAppointmentService.years} Y/s, {latestAppointmentService.months} Mon/s, {latestAppointmentService.days} Day/s
                </p>
              )}
            </div>
          )}
          {data.terminateDate && (
            <div className="flex flex-col">
              <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Termination Date</h3>
              <p className="font-light text-sm lg:text-2xl">{formattedTerminateDate}</p>
            </div>
          )}

          {data.emergencyContactName && (
            <div className="flex flex-col">
              <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Contact Person</h3>
              <p className="font-light text-sm lg:text-2xl items-start">
                {data.emergencyContactName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
              </p>
            </div>
          )}
          {data.emergencyContactNumber && (
            <div className="flex flex-col  ">
              <h3 className="font-semibold lg:mr-2 text-sm lg:text-2xl">Emerg. Contact #</h3>
              <p className="font-light text-sm lg:text-2xl items-start">
                {data.emergencyContactNumber}
              </p>
            </div>
          )}

        </div>
      </div>

    </div>);
}

export default Info;