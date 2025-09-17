"use client"

import { Separator } from "@/components/ui/separator";
import { Employees } from "../../types";
import IconButton from "./icon-button";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { ClipboardEdit, CopyIcon, FolderMinus, FolderOpen, Settings2Icon } from "lucide-react";
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
import { QrCodeGenerator } from "@/components/qr-generator";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import CopyOptionsModal from "../copy-options";
import { toast } from "sonner";
import { computeStep } from "@/utils/compute-step";

import { applyFormat, buildCopyFullName, buildFullName } from "@/utils/formatters";
import { DetailItem } from "./detail-item";
import { salarySchedule } from "@/utils/salarySchedule";


type Field = "fullName" | "position" | "office";


interface InfoProps {
  data: Employees | EmployeesColumn;
}

const Info = ({
  data,
}: InfoProps) => {
const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
const [selectedFields, setSelectedFields] = useState<Field[]>(["fullName"]);
const [format, setFormat] = useState<"uppercase" | "lowercase" | "capitalize">("capitalize");
const [isInfoOpen, setIsInfoOpen] = useState(false);
const [copied, setCopied] = useState(false);

const savedSalary = Number(data?.salary ?? 0); // ← manual/DB value, if any

const grade = Number(data?.salaryGrade ?? 0);
const step = computeStep({
  dateHired: data?.dateHired,
  latestAppointment: data?.latestAppointment,
}) || 1;

const salaryRecord = salarySchedule.find((s) => s.grade === grade);
const computedSalary = salaryRecord ? (salaryRecord.steps[step - 1] ?? 0) : 0;

// tiny tolerance to avoid rounding issues
const EPS = 0.5;
// If saved ≈ computed => AUTO; otherwise MANUAL
const isManual = !(Math.abs(savedSalary - computedSalary) <= EPS);

const displaySalary = isManual ? savedSalary : computedSalary;
const formattedSalary = formatSalary(String(displaySalary));
const salaryMode = isManual ? "MANUAL" : "AUTO";




const monthlySalary = salaryRecord ? salaryRecord.steps[step - 1] ?? 0 : 0;

const annualSalary = calculateAnnualSalary(String(monthlySalary));
const formattedAddress = addressFormat(data);

const yearService = calculateYearService(data.dateHired, data.terminateDate);
const latestAppointmentService = calculateYearServiceLatestAppointment(data.latestAppointment);

const formattedDateHired = getBirthday(data.dateHired);
const formattedLatestAppointment = formatLatestAppointment(data.latestAppointment);
const formattedTerminateDate = formatTerminateDate(data.terminateDate);
const calculatedAge = calculateAge(data.birthday);
const formattedBirthday = getBirthday(data.birthday);

const fullName = buildFullName(data);
const copyFullName = buildCopyFullName(data);

const copyData: Record<Field, string> = {
  fullName: copyFullName,
  office: data.offices?.name || "",
  position: data.position || "",
};

// Load saved copy options
useEffect(() => {
  const saved = localStorage.getItem("copyOptions");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.fields && parsed.format) {
        setSelectedFields(parsed.fields);
        setFormat(parsed.format);
      }
    } catch {}
  }
}, []);

const handleInfoClose = () => {
  localStorage.setItem("copyOptions", JSON.stringify({ fields: selectedFields, format }));
  setIsInfoOpen(false);
};

const previewText = useMemo(() => {
  const parts = selectedFields.map((field) => copyData[field]);
  return applyFormat(parts.join(", "), format);
}, [selectedFields, format, copyData]);

const handleCopy = () => {
  navigator.clipboard.writeText(previewText);
  setCopied(true);
  toast.success("Copied to clipboard!");
  setTimeout(() => setCopied(false), 2000);
};



  return (
   <div
  className="bg-white p-6 rounded-xl shadow-lg border-4 print:border-0 print:shadow-none print:p-0 print:rounded-none transition-shadow duration-300 hover:shadow-2xl max-w-7xl mx-auto"
  style={{ borderColor: data?.employeeType?.value }}
>

      {/* Status Banner */}
      <div
        className={`-mx-6 -mt-6 mb-6 rounded-t-xl text-white text-center py-3 print:shadow-none flex items-center justify-center gap-2
        ${data?.isArchived
            ? "bg-gradient-to-r from-red-600 via-red-700 to-red-800 animate-pulse"
            : "bg-gradient-to-r from-green-600 via-green-700 to-green-800"}
        `}
        aria-live="polite"
      >
        {data?.isArchived ? (
          <>
            <span className="text-xl">⚠️</span>
            <span className="text-sm sm:text-base font-semibold tracking-wide uppercase">
              This employee is no longer in active service
            </span>
          </>
        ) : (
          <span className="text-sm sm:text-base font-semibold tracking-wide uppercase">
            This employee is currently active
          </span>
        )}
      </div>

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        {/* Employee Info */}
        <div className="flex-1 space-y-3">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight flex items-center gap-3">
            {fullName}
            {data.isHead && (
              <ActionTooltip label="Executive Level" side="right">
                <span className="inline-flex items-center justify-center rounded-full p-1 bg-yellow-100 shadow-md hover:bg-yellow-200 transition-colors cursor-default">
                  <StarFilledIcon className="h-6 w-6 text-yellow-600" />
                </span>
              </ActionTooltip>
            )}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-lg font-semibold text-gray-800">{data.position}</p>
            {data.salaryGrade && (
              <Badge variant="secondary" className="text-sm px-3 py-1">
                S.G. {data.salaryGrade}
              </Badge>
            )}
          </div>

          <div className="mb-4 gap-4 mt-4 text-gray-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Appointment:</span>
              <Badge
                style={{
                  backgroundColor: data?.employeeType?.value,
                  color: "white",
                }}
                className="shadow-sm"
              >
                {data?.employeeType?.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Department:</span>
              <span className="text-muted-foreground">{data?.offices?.name}</span>
            </div>
            {/* Add other fields with tooltips if needed */}
          </div>

        </div>
        {/* QR Code and Controls */}
       <div className="flex flex-col items-center gap-4 mt-4 sm:mt-1 print:hidden">
          <div className="hidden md:flex gap-3">
            <Button
              onClick={handleCopy}
              variant="outline"
              size="icon"
              className="flex items-center gap-2"
              aria-label="Copy employee details"
            >
              <CopyIcon className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsCopyModalOpen(true)}
              className="flex items-center gap-2"
              aria-label="Open copy settings"
            >
              <Settings2Icon />
            </Button>
          </div>

     <div className="transition-transform transform hover:scale-110 cursor-pointer">
    <QrCodeGenerator departmentId={data.department} employeeId={data.id} />
  </div>

          <CopyOptionsModal
            isOpen={isCopyModalOpen}
            onClose={() => setIsCopyModalOpen(false)}
            data={copyData}
          />
        </div>
      </div>


      <div className="flex items-center justify-between my-4">
        {/* Employee Files Button */}
        {data.employeeLink && (
          <Button
            onClick={() => window.open(data.employeeLink, "_blank")}

             className="group px-4 py-2 sm:px-5 sm:py-2 font-semibold text-white flex items-center gap-3 rounded-md shadow-lg transition-all hover:shadow-xl hover:scale-[1.03]"
            style={{ backgroundColor: data.employeeType.value }}
            aria-label="Open employee files"
          >
            <span className="relative w-6 h-6">
              <FolderMinus className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-0" />
              <FolderOpen className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </span>
            <span className="text-base">Employee Files</span>
          </Button>
        )}
      </div>

      <Separator />

      {/* Cards Sections */}
      <Card className="mb-8 shadow-lg hover:shadow-xl transition-shadow rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-800">
          <DetailItem label="Bio/Employee No." value={data?.employeeNo || "—"} />
          <DetailItem label="Gender" value={data?.gender || "—"} />
          <DetailItem label="Birthday" value={formattedBirthday || "—"} />
          <DetailItem label="Age" value={calculatedAge || "—"} />
          <DetailItem label="Educational Attainment" value={data?.education || "—"} />
         <DetailItem label="Contact Number" value={formatContactNumber(data.contactNumber)} />
          <DetailItem label="Address" value={formattedAddress || "—"} />
          <DetailItem
            label="Emergency Contact Person"
            value={
              data.emergencyContactName
                ? data.emergencyContactName
                  .split(" ")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(" ")
                : "—"
            }
          />
          <DetailItem label="Emergency Contact Number" value={data.emergencyContactNumber || "—"} />
        </CardContent>
      </Card>

      <Card className="mb-8 shadow-lg hover:shadow-xl transition-shadow rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Employment Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-800">
          <DetailItem label="Appointment Type" value={data?.employeeType?.name || "—"} />
          <DetailItem label="Eligibility" value={data?.eligibility?.name || "—"} />
          <DetailItem label="Date Hired" value={formattedDateHired || "—"} />
          <DetailItem
            label="Service Rendered"
            value={`${yearService.years} Y/s, ${yearService.months} Mon/s, ${yearService.days} Day/s`}
          />
          <DetailItem
  label="Monthly Salary"
  value={
    <span className="inline-flex items-center gap-2">
      <span>{formattedSalary}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{salaryMode}</span>
    </span>
  }
/>
          <DetailItem label="Annual Salary" value={annualSalary || "—"} />
          <DetailItem label="Latest Appointment" value={formattedLatestAppointment || "—"} />
          <DetailItem
            label="Years of Service (Latest Appointment)"
            value={
              latestAppointmentService?.years ||
                latestAppointmentService?.months ||
                latestAppointmentService?.days
                ? `${latestAppointmentService.years} Y/s, ${latestAppointmentService.months} Mon/s, ${latestAppointmentService.days} Day/s`
                : "—"
            }
          />
          <DetailItem label="Termination Date" value={formattedTerminateDate || "—"} />
        </CardContent>
      </Card>

      <Card className="mb-8 shadow-lg hover:shadow-xl transition-shadow rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Government Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-800">
          <DetailItem label="GSIS No" value={formatGsisNumber(data?.gsisNo) || "—"} />
          <DetailItem label="TIN" value={data?.tinNo || "N/A"} />
          <DetailItem label="Pag-IBIG No" value={formatPagIbigNumber(data?.pagIbigNo) || "—"} />
          <DetailItem label="PhilHealth No" value={formatPhilHealthNumber(data?.philHealthNo) || "—"} />
          <DetailItem label="Member Policy No" value={data?.memberPolicyNo || "—"} />
        </CardContent>
      </Card>
    </div>
  );
}

export default Info;