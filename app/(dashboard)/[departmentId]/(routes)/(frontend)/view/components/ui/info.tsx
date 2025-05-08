"use client"

import { Separator } from "@/components/ui/separator";
import { Employees } from "../../types";
import IconButton from "./icon-button";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FolderMinus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  formatGsisNumber,
  getBirthday
} from "../../../../../../../../utils/utils";
import { EmployeesColumn } from "../../../../employees/components/columns";
import { Badge } from "@/components/ui/badge";




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
  const formattedDateHired = getBirthday(data.dateHired);
  const formattedLatestAppointment = formatLatestAppointment(data.latestAppointment);
  const formattedTerminateDate = formatTerminateDate(data.terminateDate);
  const calculatedAge = calculateAge(data.birthday);
  const formattedBirthday = getBirthday(data.birthday);


  const fullName = `${data.prefix} ${data.firstName.toUpperCase()} ${data.nickname ? `"${data.nickname}"` : ""} ${data.middleName.length === 1 ? data.middleName.toUpperCase() + '.' : data.middleName.toUpperCase()} ${data.lastName.toUpperCase()} ${data.suffix.toUpperCase()}`;


  const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="mb-1">
      <h3 className="text-xs sm:text-sm text-muted-foreground">{label}</h3>
      <p className="text-sm sm:text-base font-medium text-gray-900">{value}</p>
    </div>

  );

  return (

    <div className="bg-white p-6 rounded-lg shadow-md " style={{ border: `10px solid ${data?.employeeType?.value}` }}
    >{data?.isArchived && (
      <div className="relative -mx-6 -mt-6 mb-6 rounded-t-lg bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white text-center py-2 px-4 shadow-inner">
        <span className="text-sm sm:text-base font-semibold tracking-wide uppercase">
          ⚠️ This employee is no longer active / Retired
        </span>
      </div>
    )}
    
      <Separator />
     

      <div className="flex items-center gap-2 mt-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
          {fullName}
        </h1>

        {data.isHead && (
          <ActionTooltip label="Executive Level" side="right">
            <span className="inline-flex items-center justify-center rounded-full p-1 bg-yellow-100">
              <StarFilledIcon className="h-5 w-5 text-yellow-600" />
            </span>
          </ActionTooltip>
        )}
      </div>

      {/* Position & Salary Grade */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3">
        <p className="text-base sm:text-lg font-medium text-gray-800">
          {data.position}
        </p>
        {data.salaryGrade && (
          <Badge variant="secondary" className="text-xs px-2 py-0.5">
            S.G. {data.salaryGrade}
          </Badge>
        )}
      </div>

      {/* Office */}
      {data?.offices?.name && (
        <p className="text-sm text-muted-foreground mt-1">
          ({data.offices.name})
        </p>
      )}

      <div className="flex items-center justify-between my-2">

        {/* Employee Files Button */}
        {data.employeeLink && (
          <div className="mt-4">
            <Button
              onClick={() => window.open(data.employeeLink, '_blank')}
              className="group px-4 py-2 font-semibold text-white flex items-center gap-3 rounded-md shadow transition-colors"
              style={{ backgroundColor: data.employeeType.value }}
            >
              <span className="relative w-5 h-5">
                <FolderMinus className="absolute inset-0 transition-opacity duration-200 group-hover:opacity-0" />
                <FolderOpen className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              </span>
              <span className="text-sm sm:text-base">Employee Files</span>
            </Button>
          </div>
        )}

      </div>
      <Separator />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailItem label="Bio/Employee No." value={data?.employeeNo} />
          <DetailItem label="Gender" value={data?.gender} />
          <DetailItem label="Birthday" value={formattedBirthday} />
          <DetailItem label="Age" value={calculatedAge} />
          <DetailItem label="Educational Attainment" value={data?.education || "—"} />
          <DetailItem label="Contact Number" value={formattedContactNumber || "—"} />
          <DetailItem label="Address" value={formattedAddress || "—"} />
          <DetailItem label="Emergency Contact Person" value={data.emergencyContactName
            ? data.emergencyContactName
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
            : '—'}
          />
          <DetailItem label="Emergency Contact Number" value={data.emergencyContactNumber || "—"} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Employment Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailItem label="Appointment Type" value={<Badge
            style={{
              backgroundColor: data?.employeeType?.value,
              color: 'white', // optional, override for contrast
            }}
          >
            {data?.employeeType?.name}
          </Badge>} />
          <DetailItem label="Eligibility" value={data?.eligibility?.name || "—"} />
          <DetailItem label="Date Hired" value={formattedDateHired || "—"} />
          <DetailItem
            label="Service Rendered"
            value={`${yearService.years} Y/s, ${yearService.months} Mon/s, ${yearService.days} Day/s`}
          />
          <DetailItem label="Monthly Salary" value={formattedSalary || "—"} />
          <DetailItem label="Annual Salary" value={annualSalary || "—"} />
          <DetailItem label="Latest Appointment" value={formattedLatestAppointment } />
          <DetailItem label="Years of Service (Latest Appointment)" value={latestAppointmentService?.years || latestAppointmentService?.months || latestAppointmentService?.days
              ? `${latestAppointmentService.years} Y/s, ${latestAppointmentService.months} Mon/s, ${latestAppointmentService.days} Day/s`
              : '—'} />
          <DetailItem label="Termination Date" value={formattedTerminateDate || "—"} /> 

        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Government Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <DetailItem label="GSIS No" value={formatGsisNumber(data?.gsisNo) || "_"} /> 
        <DetailItem label="TIN" value={data?.tinNo || 'N/A'} /> 
        <DetailItem label="Pag-IBIG No" value={formatPagIbigNumber(data?.pagIbigNo)} /> 
        <DetailItem label="PhilHealth No" value={formatPhilHealthNumber(data?.philHealthNo)} /> 
        <DetailItem label="GSIS No" value={formatGsisNumber(data?.gsisNo) || "_"} /> 
        <DetailItem label="Member Policy No" value={data?.memberPolicyNo || "—"} /> 
        </CardContent>
      </Card>


      
    </div>);
}

export default Info;