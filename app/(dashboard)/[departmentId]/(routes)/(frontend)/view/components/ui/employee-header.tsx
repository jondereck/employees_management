"use client";

import { BadgeCheck, Briefcase, Hash, Building2, Ban, FolderOpen, Calendar, ChevronRight, Crown } from "lucide-react";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import { QrCodeGenerator } from "@/components/qr-generator";
import Gallery from "../gallery";
import { buildNameWithInitial } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
// Cleaned up imports
import TogglePublicBadge from "../../../../settings/components/toggle-public-button";
import { cn } from "@/lib/utils";

interface Props {
  employee: Employees;
}

const EmployeeHeader = ({ employee }: Props) => {
  const fullName = buildNameWithInitial(employee);
  const lastUpdated = employee.updatedAt ? format(new Date(employee.updatedAt), "MMMM do, yyyy") : "N/A";

  return (
    <div className="relative flex flex-col lg:flex-row items-stretch justify-between gap-6 border-b border-slate-200 pb-8 pt-4">

      {/* LEFT SECTION: Profile & Info - Changed to items-center to center the Gallery */}
      <div className="flex flex-col md:flex-row items-center gap-8 flex-1">

        {/* Profile Image/Gallery - Centered vertically relative to text */}
        <div className="w-full md:w-56 shrink-0">
          <div className="aspect-square rounded-2xl overflow-hidden shadow-md border-4 border-white bg-slate-100">
            <Gallery
              images={employee.images || []}
              employeeId={employee.id}
              employeeNo={employee.employeeNo}
              gender={employee.gender as "Male" | "Female"}
            />
          </div>
        </div>

        {/* Core Details */}
        <div className="flex flex-col space-y-5 w-full">
          {/* Status Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* HEAD OF OFFICE BADGE */}
            {employee.isHead && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
                <Crown className="h-3 w-3 fill-amber-700" />
                Head of Office
              </span>
            )}

            {/* Clickable Toggle Badge */}
            <TogglePublicBadge
              employeeId={employee.id}
              initialEnabled={!!employee.publicEnabled}
            />

            {/* Active/Archived Badge */}
            <span className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border",
              !employee.isArchived
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            )}>
              {!employee.isArchived ? <BadgeCheck className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
              {!employee.isArchived ? "Active" : "Archived"}
            </span>

          </div>

          {/* Name Display */}
          <div className="space-y-1">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none uppercase">
              {fullName}
            </h1>
            <div className="flex items-start gap-2 text-slate-600">


              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold text-slate-800">
                    {employee.position}
                  </span>

                  {employee.salaryGrade && (
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-[2px] rounded-full text-[10px] font-bold tracking-wide">
                      SG-{employee.salaryGrade}
                    </span>
                  )}
                </div>

                {employee.note && (
                  <span className="text-xs text-slate-400 mt-0.5 line-clamp-1 italic">
                    {employee.note}
                  </span>
                )}
              </div>
            </div>
            {employee.employeeType && (
              <Badge
                style={{ backgroundColor: employee.employeeType.value, color: "white" }}
                className="px-2.5 py-1 text-[10px] font-black uppercase border-none shadow-sm"
              >
                {employee.employeeType.name}
              </Badge>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Building2 className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Assigned Office</p>
                <p className="text-sm font-semibold">{employee.offices?.name || "Not Assigned"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Hash className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Employee Id</p>
                <p className="text-sm font-mono font-bold">{employee.employeeNo}</p>
              </div>
            </div>
          </div>

          {/* Footer Info & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 mt-auto">
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <p className="text-xs">Last updated: <span className="font-medium text-slate-600">{lastUpdated}</span></p>
            </div>

            {employee.employeeLink && (
              <Button
                onClick={() => window.open(employee.employeeLink, "_blank")}
                className="h-9 px-4 text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2 rounded-lg transition-transform active:scale-95 shadow-lg shadow-emerald-900/10"
                style={{ backgroundColor: employee.employeeType?.value || "#10b981" }}
              >
                <FolderOpen className="h-4 w-4" />
                View Digital Folder
                <ChevronRight className="h-3 w-3 opacity-50" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SECTION: QR Code Sidebar */}
      <div className="lg:w-48 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-inner">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <QrCodeGenerator
            departmentId={employee.department}
            employeeId={employee.id}
            employeeNo={employee.employeeNo}
            publicId={employee.publicId}
            publicVersion={employee.publicVersion}
            publicEnabled={employee.publicEnabled}
            size={120}
          />
        </div>
        <div className="mt-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
            Employee QR
          </p>
          <p className="text-[9px] text-slate-400 italic">Official Verification</p>
        </div>
      </div>
    </div>
  );
};

export default EmployeeHeader;