"use client";

import { buildFullName } from "@/utils/formatters";
import { Employees } from "../../types";
import {
  calculateAge,
  calculateYearService,
  addressFormat,
  formatSalary,
  getBirthday,
  formatTerminateDate,
  formatContactNumber,
  formatLatestAppointment,
  calculateAnnualSalary,
} from "@/utils/utils";
import { computeStep } from "@/utils/compute-step";
import { salarySchedule } from "@/utils/salarySchedule";
import { formatUpdatedAt } from "@/utils/date";

interface InfoProps {
  data: Employees;
}

const Info = ({ data }: InfoProps) => {
  const age = calculateAge(data.birthday);
  const yearsOfService = calculateYearService(data.dateHired, data.terminateDate);

  const renderItem = (label: string, value: string | number | undefined | null) => (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-slate-900">
        {value || <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );

  const fullName = buildFullName(data);
  const formattedBirthday = getBirthday(data.birthday);
  const formattedTerminateDate = formatTerminateDate(data.terminateDate);
  const formattedDateHired = getBirthday(data.dateHired);
  const formattedCNumber = formatContactNumber(data.contactNumber)
  const formattedENumber = formatContactNumber(data.emergencyContactNumber)
  const formattedLatestAppointment = formatLatestAppointment(data.latestAppointment)


  const savedSalary = Number(data?.salary ?? 0);
  const salaryMode = (data?.salaryMode ?? "AUTO").toUpperCase();

  // AUTO COMPUTATION
  const grade = Number(data?.salaryGrade ?? 0);

  const computedStep = computeStep({
    dateHired: data?.dateHired,
    latestAppointment: data?.latestAppointment,
  }) || 1;

  const salaryRecord = salarySchedule.find((s) => s.grade === grade);

  // clamp step safely
  const safeStep = salaryRecord
    ? Math.min(computedStep, salaryRecord.steps.length)
    : 0;

  const computedSalary =
    salaryRecord && safeStep > 0
      ? salaryRecord.steps[safeStep - 1] ?? 0
      : 0;

  // FINAL RESOLUTION
  const resolvedSalary =
    salaryMode === "MANUAL"
      ? savedSalary
      : computedSalary;

  const formattedSalary =
    resolvedSalary > 0
      ? formatSalary(String(resolvedSalary))
      : "";



  const lastUpdated = formatUpdatedAt(data?.updatedAt, { tz: "Asia/Manila" });

  const monthlySalary = resolvedSalary;

  const annualSalary =
    monthlySalary > 0
      ? calculateAnnualSalary(String(monthlySalary))
      : "—";

  const resolvedStep =
    salaryMode === "MANUAL"
      ? Number(data?.salaryStep ?? 1)
      : computedStep;


  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">

      {/* PERSONAL DETAILS CARD */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Personal Details</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8">
          {renderItem("Full Name", fullName)}
          {renderItem("Employee Id", data.employeeNo)}
          {renderItem("Gender", data.gender)}
          {renderItem("Birthday", formattedBirthday)}
          {renderItem("Age", `${age} years old`)}
          {renderItem("Education", data.education)}
          {renderItem("Contact Number", formattedCNumber)}
          <div className="sm:col-span-2 lg:col-span-3">
            {renderItem("Address", addressFormat(data))}
          </div>
          {renderItem("Emergency Contact", data.emergencyContactName)}
          {renderItem("Emergency Number", formattedENumber)}
        </div>
      </section>

      {/* EMPLOYMENT & GOVERNMENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* EMPLOYMENT INFO */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-800">Employment Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {renderItem("Plantilla Designation", data.designation?.name || "Not Assigned")}
            {renderItem("Position", data.position)}
            {renderItem("Office", data.offices?.name)}
            {renderItem("Appointment", data.employeeType?.name)}

            {/* ADDED SG AND STEP HERE */}
            {renderItem("Salary Grade", data.salaryGrade)}
            {renderItem("Step Increment", resolvedStep)}

            <div className="sm:col-span-2">
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  Monthly Salary
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${salaryMode === "AUTO"
                    ? "bg-blue-50 text-blue-600 border-blue-100"
                    : "bg-amber-50 text-amber-600 border-amber-100"
                    }`}>
                    {salaryMode}
                  </span>
                </dt>
                <dd className="text-sm font-semibold text-slate-900">
                  {formattedSalary || <span className="text-slate-300">—</span>}
                </dd>
              </div>
            </div>
            {renderItem("Annual Increment", annualSalary)}
            {renderItem("Eligibility", data.eligibility?.name)}
            {renderItem("Date Hired", formattedDateHired)}
            {renderItem("Latest Appointment", formattedLatestAppointment || "—")}
            {renderItem("Termination", formattedTerminateDate)}
            {renderItem("Service Length", `${yearsOfService.years}y ${yearsOfService.months}m`)}


          </div>
        </section>

        {/* GOVERNMENT DETAILS */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-800">Government Identifiers</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {renderItem("GSIS No", data.gsisNo)}
            {renderItem("TIN", data.tinNo)}
            {renderItem("Pag-IBIG No", data.pagIbigNo)}
            {renderItem("PhilHealth No", data.philHealthNo)}
            <div className="sm:col-span-2">
              {renderItem("Member Policy No", data.memberPolicyNo)}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Info;