"use client"

import { Separator } from "@/components/ui/separator";
import { Employees } from "../../types";
import IconButton from "./icon-button";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { CheckCircle, ClipboardEdit, CopyIcon, FolderMinus, FolderOpen, Settings2Icon, X, XCircle } from "lucide-react";
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
import { toast } from "sonner";
import { computeStep } from "@/utils/compute-step";

import { applyFormat, buildCopyFullName, buildFullName } from "@/utils/formatters";
import { DetailItem } from "./detail-item";
import { salarySchedule } from "@/utils/salarySchedule";
import { formatUpdatedAt } from "@/utils/date";

import { buildPreview, loadCopyOptions } from "@/utils/copy-utils";
import { useRouter } from "next/navigation";

export function CardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-8 shadow-lg hover:shadow-xl transition-shadow rounded-xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-x-8 gap-y-4 text-gray-800">
        {children}
      </CardContent>
    </Card>
  );
}

type Field = "fullName" | "position" | "office";


interface InfoProps {
  data: Employees | EmployeesColumn;
}

const Info = ({
  data,
}: InfoProps) => {


  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const hasText = (v?: string | null) => !!v && v.trim().length > 0;

  const savedSalary = Number(data?.salary ?? 0); // ← manual/DB value, if any

  const grade = Number(data?.salaryGrade ?? 0);
  const step = computeStep({
    dateHired: data?.dateHired,
    latestAppointment: data?.latestAppointment,
  }) || 1;

  const salaryRecord = salarySchedule.find((s) => s.grade === grade);
  const computedSalary = salaryRecord ? (salaryRecord.steps[step - 1] ?? 0) : 0;

  const salaryModeFromData = data?.salaryMode?.toUpperCase();
  // tiny tolerance to avoid rounding issues when salaryMode isn't available
  const EPS = 0.5;
  const isManual = salaryModeFromData
    ? salaryModeFromData === "MANUAL"
    : !(Math.abs(savedSalary - computedSalary) <= EPS);

  const resolvedSalary = isManual ? savedSalary : computedSalary;
  const displaySalary = resolvedSalary > 0 ? resolvedSalary : savedSalary;
  const formattedSalary = formatSalary(String(displaySalary));
  const salaryMode = isManual ? "MANUAL" : "AUTO";


  const lastUpdated = formatUpdatedAt(data?.updatedAt, { tz: "Asia/Manila" });

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

  const handleCopy = async () => {
    const options = loadCopyOptions();             // reads from localStorage; falls back to defaults
    const text = buildPreview(copyData, options);  // applies office sanitizer + smart title-case
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const isJobOrder = (et?: { value?: string | null; name?: string | null }) => {
    const v = (et?.value ?? "").toUpperCase();
    const n = (et?.name ?? "").toUpperCase();
    // match common encodings
    return (
      v === "JOB_ORDER" ||
      v === "COS" ||
      n.includes("JOB ORDER") ||
      n.includes("CONTRACT OF SERVICE") ||
      n === "JO"
    );
  };
  return (
    <div
      className="bg-white p-6 rounded-xl shadow-lg border print:border-0 print:shadow-none print:p-0 print:rounded-none transition-shadow duration-300 hover:shadow-2xl max-w-7xl mx-auto"
      style={{ borderColor: data?.employeeType?.value }}
    >
      {/* Status Banner */}
      <div
        className={`-mx-6 -mt-6 mb-6 rounded-t-xl text-white text-center py-3 flex items-center justify-center gap-2
      ${data?.isArchived
            ? "bg-gradient-to-r from-red-600 via-red-700 to-red-800 animate-pulse"
            : "bg-gradient-to-r from-green-600 via-green-700 to-green-800"}
    `}
        aria-live="polite"
      >
        {data?.isArchived ? (
          <>
            <XCircle className="h-5 w-5" />
            <span className="text-sm sm:text-base font-semibold tracking-wide uppercase">
              No longer in active service
            </span>
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm sm:text-base font-semibold tracking-wide uppercase">
              Currently active
            </span>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Last updated: {lastUpdated}
      </p>
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

         <div className="flex flex-col">
  {/* Position row */}
  <div className="flex flex-wrap items-center">
    <p className="text-xl font-bold text-gray-900 tracking-tight">
      {data.position}
    </p>

    {Number(data.salaryGrade) > 0 && !isJobOrder(data.employeeType) && (
      <Badge
        variant="secondary"
        className="text-xs font-medium px-2 py-0.5 opacity-80"
      >
        S.G. {data.salaryGrade}
      </Badge>
    )}
  </div>

  {/* Note */}
  {hasText(data?.note) && (
    <p className="text-xs font-light text-gray-500 whitespace-pre-wrap">
      {data.note}
    </p>
  )}
</div>

          <div className="text-gray-700 space-y-2 mt-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Appointment:</span>
              <Badge
                style={{ backgroundColor: data?.employeeType?.value, color: "white" }}
                className="shadow-sm"
              >
                {data?.employeeType?.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Department:</span>
              <span className="text-muted-foreground">{data?.offices?.name}</span>
            </div>

          </div>


        </div>

        {/* QR + Controls */}
        <div className="flex flex-col items-center gap-4 mt-4 sm:mt-1 print:hidden">
          <div className="flex gap-3">
            <ActionTooltip label="Copy employee details">
              <Button onClick={handleCopy} variant="outline" size="icon">
                <CopyIcon className="w-4 h-4" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Copy options">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push(`/${data.department}/tools/copy-options`)}
              >
                <Settings2Icon />
              </Button>
            </ActionTooltip>

          </div>

          <div className="transition-transform transform hover:scale-110 cursor-pointer">
            <QrCodeGenerator departmentId={data.department} employeeId={data.id} employeeNo={data.employeeNo} />
          </div>

        </div>
      </div>

      {/* Employee Files */}
      {data.employeeLink && (
        <div className="flex items-center justify-between my-4">
          <Button
            onClick={() => window.open(data.employeeLink, "_blank")}
            className="group px-4 py-2 sm:px-5 sm:py-2 font-semibold text-white flex items-center gap-3 rounded-md shadow-lg transition-all hover:shadow-xl hover:scale-[1.03]"
            style={{ backgroundColor: data.employeeType.value }}
          >
            <FolderOpen className="h-5 w-5" />
            Employee Files
          </Button>
        </div>
      )}

      <Separator />

      {/* Cards */}
      <CardSection title="Personal Details">
        <DetailItem label="Bio/Employee No." value={data?.employeeNo || "—"} />
        {data?.designation?.name?.trim() && (
          <DetailItem label="Plantilla Office" value={data.designation!.name} />
        )}
        <DetailItem label="Gender" value={data?.gender || "—"} />
        <DetailItem label="Birthday" value={formattedBirthday || "—"} />
        <DetailItem label="Age" value={calculatedAge || "—"} />
        <DetailItem label="Educational Attainment" value={data?.education || "—"} />
        <DetailItem label="Contact Number" value={formatContactNumber(data.contactNumber)} />
        <DetailItem label="Address" value={formattedAddress || "—"} />
        <DetailItem
          label="Emergency Contact Person"
          value={data.emergencyContactName || "—"}
        />
        <DetailItem label="Emergency Contact Number" value={data.emergencyContactNumber || "—"} />
      </CardSection>

      <CardSection title="Employment Information">
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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {salaryMode}
              </span>
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
      </CardSection>

      <CardSection title="Government Details">
        <DetailItem label="GSIS No" value={formatGsisNumber(data?.gsisNo) || "—"} />
        <DetailItem label="TIN" value={data?.tinNo || "N/A"} />
        <DetailItem label="Pag-IBIG No" value={formatPagIbigNumber(data?.pagIbigNo) || "—"} />
        <DetailItem label="PhilHealth No" value={formatPhilHealthNumber(data?.philHealthNo) || "—"} />
        <DetailItem label="Member Policy No" value={data?.memberPolicyNo || "—"} />
      </CardSection>
    </div>

  );
}

export default Info;
