// app/(dashboard)/[departmentId]/(routes)/(frontend)/view/employee/[employeeId]/page.tsx


import { auth, currentUser } from "@clerk/nextjs/server";
import Image from "next/image";
import prismadb from "@/lib/prismadb";

import getEmployee from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employee";
import getEmployees from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employees";
import Container from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/container";
import Info from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/info";
import Footer from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/footer";
import CameraScannerWrapper from "@/components/camera-scanner-wrapper";

import BrandHeader from "@/components/public/brand-header";
import PublicFooter from "@/components/public/footer";
import ReportIssueBox from "@/components/public/report-issue-box";
import EmployeeList from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/employee-list";
import PublicTimeline from "@/app/(public)/components/public-timeline";
import PublicAwardsGallery from "@/app/(public)/components/public-awards.gallery";
import PublicSelfServiceActions from "@/app/(public)/components/public-self-service-actions";
import DownloadPhotoButton from "@/app/(public)/components/download-photo";
import PublicHeadshot from "@/app/(public)/components/download-photo";
import { normalizeEducationLines } from "@/utils/normalize-education";
import { ActiveBadge } from "@/app/(public)/components/icons/active-badges";
import AutoTrackPublicView from "@/components/public/auto-track-public-view";
import RegenerateQrButton from "@/app/(public)/components/regenerate-qr-button";
import EmployeeHeader from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/employee-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WorkSchedulePreview from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/work-schedule-preview";
import AwardPreview from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/award-preview";
import EmploymentEventPreview from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/employment-event-preview";
import { cn } from "@/lib/utils";
import { Building2, CalendarCheck, Fingerprint, History, Hourglass, ShieldCheck, Trophy } from "lucide-react";


export const dynamic = "force-dynamic";
export const revalidate = 0;

// Decide if the visitor is an admin for THIS department
async function resolveIsAdmin(departmentId: string) {
  const { userId } = auth();
  if (!userId) return false;

  // (A) Role in Clerk public metadata
  const user = await currentUser().catch(() => null);
  const role = (user?.publicMetadata as any)?.role;
  if (role === "admin") return true;

  // (B) Department owner
  const dept = await prismadb.department.findUnique({
    where: { id: departmentId },
    select: { userId: true },
  });
  if (dept?.userId === userId) return true;

  return false;
}





interface EmployeeInvdividualPageProps {
  params: {
    departmentId: string;
    employeeId: string;
  };
  searchParams: {
    pid?: string;
    v?: string;
  };
}



export default async function EmployeeInvdividualPage({
  params,
  searchParams,
}: EmployeeInvdividualPageProps) {
const isAdmin = await resolveIsAdmin(params.departmentId);

/* ============================
 * QR VALIDATION (PUBLIC ONLY)
 * ============================ */

const rawPid = searchParams?.pid;
const rawV = searchParams?.v;

const pid =
  typeof rawPid === "string" && rawPid !== "undefined"
    ? rawPid
    : null;

const version = Number(rawV);
const isValidVersion = Number.isInteger(version) && version > 0;

const expiredScreen = (
  <div className="mx-auto max-w-md p-6 text-center">
    <h1 className="text-lg font-semibold">QR Code Expired</h1>
    <p className="text-sm text-muted-foreground">
      This employee ID has been revoked or replaced.
    </p>
  </div>
);
// ADMIN BYPASSES QR CHECK
if (!isAdmin) {
  if (pid && isValidVersion) {
    // 🔐 NEW SECURE QR (post-upgrade)
    const valid = await prismadb.employee.findFirst({
      where: {
        id: params.employeeId,
        publicId: pid,
        publicEnabled: true,
        publicVersion: version,
      },
      select: { id: true },
    });

    if (!valid) {
      return expiredScreen;
    }
  } else {
    // 🟡 LEGACY PRINTED QR (pre-upgrade)
    const legacy = await prismadb.employee.findFirst({
      where: {
        id: params.employeeId,
        publicEnabled: true,
        legacyQrAllowed: true, // 👈 NEW COLUMN
      },
      select: { id: true },
    });

    if (!legacy) {
      return expiredScreen;
    }
  }
}



  /** ==========================
   *  ADMIN VIEW (unchanged)
   *  ========================== */
  if (isAdmin) {
    const employee = await getEmployee(params.employeeId);

    const officeId = employee?.offices?.id ?? employee?.offices ?? undefined;

    let suggestedPeople = await getEmployees({
      officeId,          // 👈 same office only
      status: "active",  // only active
    });

    // (optional) exclude the current employee + cap the list
    suggestedPeople = suggestedPeople
      .filter(p => p.id !== employee.id)
      .slice(0, 8);



    return (
      
      <div className="bg-white">
  <Container>
    {/* 🟢 MAIN CONTAINER: Vertical flow */}
    <div className="mx-auto w-full max-w-5xl space-y-8 p-2 sm:p-4 lg:p-6">

      {/* 1️⃣ HEADER SECTION (same as Preview) */}
      <EmployeeHeader employee={employee} />

      {/* 2️⃣ TABS SECTION */}
      <Tabs defaultValue="info" className="w-full">
        {/* Tabs header */}
        <div className="flex items-center justify-between border-b pb-2 mb-6">
          <TabsList className="bg-transparent h-auto p-0 gap-6">
            <TabsTrigger
              value="info"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
            >
              Info
            </TabsTrigger>

            <TabsTrigger
              value="schedule"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
            >
              Schedule
            </TabsTrigger>

            <TabsTrigger
              value="awards"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
            >
              Awards
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
            >
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 3️⃣ TAB CONTENT AREA */}
        <div className="mt-4">
          <TabsContent value="info" className="outline-none">
            <Info data={employee} />
          </TabsContent>

          <TabsContent value="schedule" className="outline-none">
            <WorkSchedulePreview
              schedules={employee.workSchedules}
            />
          </TabsContent>

          <TabsContent value="awards" className="outline-none">
            <AwardPreview
              awards={employee.awards}
            />
          </TabsContent>

          <TabsContent value="history" className="outline-none">
            <EmploymentEventPreview
              events={employee.employmentEvents}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Optional related section */}
      <EmployeeList
        title="Related Personnel"
        items={suggestedPeople}
      />

    </div>

    <CameraScannerWrapper />
    <Footer />
  </Container>
</div>

    );
  }


  const dept = await prismadb.department.findUnique({
    where: { id: params.departmentId },
    select: { name: true },
  });

  /** ==========================
   *  PUBLIC VIEW (revamped)
   *  ========================== */

  // Pull only safe, displayable fields + isArchived for the status
  type PublicImage = {
    id: string;
    url: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  };



  const employeeId = params.employeeId;
  const publicData = await prismadb.employee.findFirst({
    where: {
      id: params.employeeId,
      departmentId: params.departmentId,
      publicEnabled: true,


    },
    select: {
      firstName: true,
      lastName: true,
      middleName: true,
      nickname: true,
      gender: true,
      prefix: true,
      suffix: true,
      birthday: true,
      employeeNo: true,
      position: true,
      education: true,
      isArchived: true, // 👈 status source (true = inactive)
      dateHired: true,       // 👈 add
      createdAt: true,
      updatedAt: true,
      offices: { select: { name: true } },
      images: {
        select: { id: true, url: true, createdAt: true, updatedAt: true },
        orderBy: [
          { createdAt: "desc" }, // 👈 latest *upload* first
          { id: "desc" },        // tie-breaker
        ],
        take: 1,                 // only need the newest
      },
      employeeType: { select: { name: true, value: true } },
      eligibility: {                    // 👈 add this
        select: {
          name: true,                   // e.g., "CSC Professional"
        },
      },

    },
  });

  const thisMonth = new Date().getMonth();

  const birthdayPeople =
    publicData && publicData.birthday
      ? (new Date(publicData.birthday).getMonth() === thisMonth
        ? [{
          id: params.employeeId,
          firstName: publicData.firstName,
          lastName: publicData.lastName,
          nickname: publicData.nickname ?? null,
          prefix: publicData.prefix ?? null,
          middleName: publicData.middleName ?? null,
          suffix: publicData.suffix ?? null,
          imageUrl: publicData.images?.[0]?.url ?? null,
          birthday: new Date(publicData.birthday).toISOString(),
        }]
        : [])
      : [];


  function norm(v?: string | null) {
    return (v ?? "").trim().toLowerCase();
  }


  const eligName = publicData?.eligibility?.name;
  const showEligibility = !!eligName && norm(eligName) !== "none" && norm(eligName) !== "n/a" && norm(eligName) !== "-";

  const edu = publicData?.education ?? "";
  const eduNormalized = normalizeEducationLines(edu);
  const showEducation = eduNormalized.length > 0;



  if (!publicData) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Profile not available</h1>
        <p className="text-sm text-muted-foreground">
          This profile is private or the public link was revoked.
        </p>
      </div>
    );
  }
  function normalizeHex(input?: string | null): string | null {
    if (!input) return null;
    const raw = input.trim();
    const m = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!/^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(m)) return null;
    const hex = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    return `#${hex.toUpperCase()}`;
  }

  function hexToRgb(hex: string) {
    const m = hex.replace('#', '');
    const int = parseInt(m, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }

  function srgbToLin(v: number) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function relLuminance({ r, g, b }: { r: number; g: number; b: number }) {
    const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  /** Mix foreground color over white at given alpha (0–1) */
  function mixOverWhite(rgb: { r: number; g: number; b: number }, alpha: number) {
    return {
      r: Math.round(rgb.r * alpha + 255 * (1 - alpha)),
      g: Math.round(rgb.g * alpha + 255 * (1 - alpha)),
      b: Math.round(rgb.b * alpha + 255 * (1 - alpha)),
    };
  }

  /** Build styles with readable text based on the *tinted* background */
  function buildBadgeStyle(colorHex?: string | null): React.CSSProperties | undefined {
    const hex = normalizeHex(colorHex || undefined);
    if (!hex) return undefined;

    const rgb = hexToRgb(hex);
    const bgAlpha = 0.14; // tint strength
    const bgMixed = mixOverWhite(rgb, bgAlpha);             // actual visible bg
    const L = relLuminance(bgMixed);

    // For very light backgrounds, use a dark text; else white
    const textColor = L > 0.6 ? '#0F172A' /* slate-900 */ : '#FFFFFF';

    // Slightly stronger border for light tints
    const borderAlpha = 0.45;

    return {
      backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${bgAlpha})`,
      borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${borderAlpha})`,
      color: textColor,
    };
  }

  function formatUpdatedAt(d?: Date | string | null) {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
    }).format(new Date(d));
  }


  const placeholder =
    publicData.gender === "Female" ? "/female_placeholder.png" :
      publicData.gender === "Male" ? "/male_placeholder.png" :
        null;

  const latest = publicData.images?.[0] as PublicImage | undefined;

  const ve =
    (latest?.updatedAt && Date.parse(String(latest.updatedAt))) ||
    (latest?.createdAt && Date.parse(String(latest.createdAt))) ||
    Date.now();

  const headshot = latest
    ? `${latest.url}${latest.url.includes("?") ? "&" : "?"}v=${ve}`
    : placeholder;


  const isInactive = !!publicData.isArchived;

  // ⟵ NEW: pretty date for “since …”
  function formatDateShort(d?: Date | string | null) {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
    }).format(new Date(d));
  }
  const orgName = dept?.name || "LGU Lingayen";
  const workingLine = isInactive
    ? `Previously associated with ${orgName} as`
    : `Currently working at ${orgName} as`;
  function diffInMonths(from: Date, to = new Date()) {
    // counts whole months between dates
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) months -= 1; // only full months
    return Math.max(0, months);
  }

  function yearsBetween(from: Date, to = new Date()) {
    const y = to.getFullYear() - from.getFullYear();
    const hasHadAnniversary =
      to.getMonth() > from.getMonth() ||
      (to.getMonth() === from.getMonth() && to.getDate() >= from.getDate());
    return hasHadAnniversary ? y : y - 1;
  }

  // ⟵ NEW: one function that returns a human label
  function getTenureLabel(from?: Date | string | null): string {
    if (!from) return "—";
    const start = new Date(from);
    if (Number.isNaN(start.getTime())) return "—";

    const years = Math.max(0, yearsBetween(start));
    if (years >= 2) return `${years} years`;
    if (years === 1) return `1 year`; // singular

    // Under 1 year → show months (e.g., “8 months”); 0 months → “< 1 month”
    const months = diffInMonths(start);
    if (months >= 1) return `${months} month${months > 1 ? "s" : ""}`;
    return "< 1 month";
  }

  const startDate = publicData.dateHired ?? publicData.createdAt;
  const tenureLabel = getTenureLabel(startDate);

  const employmentType = publicData.employeeType?.name ?? null;
  const typeHex = publicData.employeeType?.value ?? null; // 👈 your DB HEX
  const isJobOrder = employmentType
    ? /job\s*order/i.test(employmentType)
    : false;

  function getMiddleInitial(name?: string | null): string {
    if (!name) return "";
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed[0].toUpperCase() + ".";
  }

  // helper (put near the top of the file)
  const empBase = (s?: string | null) =>
    (s ?? "").split(",")[0]?.trim() || "photo";

  // get the value from wherever your page already loaded the data
  // examples (pick ONE that matches your code):
  // 1) from a server-fetched object:
  const employeeNo: string | null | undefined = publicData?.employeeNo;
  // 2) or from initialData:
  // const employeeNo = initialData?.employeeNo;
  // 3) or from props:
  // const { employeeNo } = props;

  const downloadName = `${empBase(employeeNo)}.png`;

  const fullName = `${publicData.prefix} ${publicData.firstName} ${getMiddleInitial(publicData.middleName)} ${publicData.lastName} ${publicData.suffix || ""}`.replace(/\s+/g, " ").trim();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <BrandHeader />
<main className="flex-1 relative overflow-hidden bg-[#f8fafc] dark:bg-[#020617] min-h-screen">
  {/* Dynamic Liquid Background - Ambient Aura */}
  <div 
    className="absolute -top-24 -right-24 w-[500px] h-[500px] blur-[150px] opacity-30 pointer-events-none rounded-full animate-pulse transition-colors duration-1000"
    style={{ backgroundColor: normalizeHex(publicData.employeeType?.value) ?? "#4f46e5" }}
  />
  <div 
    className="absolute bottom-0 left-0 w-[400px] h-[400px] blur-[120px] opacity-10 pointer-events-none rounded-full"
    style={{ backgroundColor: normalizeHex(publicData.employeeType?.value) ?? "#6366f1" }}
  />

  <div className="px-4 py-12 sm:px-6 lg:px-8 relative z-20 max-w-5xl mx-auto">
    {/* Header Card: The Main Glass Vessel */}
    <div
      className="relative overflow-hidden rounded-[40px] border backdrop-blur-3xl bg-white/60 dark:bg-slate-900/40 p-1 sm:p-1.5 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] transition-all duration-500"
      style={{
        borderColor: `${normalizeHex(publicData.employeeType?.value) ?? "#e5e7eb"}33`,
      }}
    >
      {/* Inner Glow/Bezel effect */}
      <div className="relative overflow-hidden rounded-[36px] bg-white/40 dark:bg-slate-900/20 p-2 sm:p-10">
        
        {/* Watermark: Deep Layer */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
          <div className="absolute -right-20 -bottom-20 opacity-[0.04] dark:opacity-[0.08] rotate-[15deg]">
            <Image
              src="/logo.png"
              alt=""
              width={400}
              height={400}
              className="grayscale"
              priority={false}
            />
          </div>
        </div>

    <div className="flex flex-col md:flex-row items-center md:items-start gap-2 relative z-10">

  {/* PHOTO */}
  <div className="shrink-0 relative group">
    
    {/* Soft Halo */}
    <div 
      className="absolute inset-0 blur-2xl opacity-20 scale-110 rounded-full transition-transform duration-500 group-hover:scale-125"
      style={{ backgroundColor: normalizeHex(publicData.employeeType?.value) ?? "#DA1677" }} 
    />

    <PublicHeadshot 
      src={headshot} 
      employeeNo={publicData?.employeeNo} 
      className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-3xl object-cover ring-6 ring-white/80 dark:ring-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.18)]" 
    />
  </div>

  {/* IDENTITY */}
  <div className="min-w-0 flex-1 text-center md:text-left">

    {/* Employment Type Badge */}
    {employmentType && (
      <div className="mb-4 flex justify-center md:justify-start">
        <span
          className="inline-flex items-center rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-xl shadow-md"
          style={buildBadgeStyle(typeHex)}
        >
          {employmentType}
        </span>
      </div>
    )}

    {/* NAME + ACTIVE */}
    <div className="flex flex-col items-center md:items-start gap-2">
      
<div className="flex flex-col gap-1">
  {/* Name + Badge Group */}
  <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1">
    <h1 className="font-black tracking-tight text-slate-900 dark:text-white text-[clamp(1.5rem,5vw,2.25rem)] leading-[1.1]">
      {fullName}
      {!publicData.isArchived && (
        <span className="inline-flex ml-3 align-middle">
          <div className="relative flex items-center justify-center h-7 w-7">
            {/* The Liquid Ripple: Multiple layers of glow */}
            <div className="absolute inset-0 bg-emerald-500/30 blur-md rounded-full animate-pulse" />
            <div className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-ping shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
            
            {/* The Badge: Using a standard SVG or your ActiveBadge component */}
            
               <ActiveBadge className="h-5 w-5 text-emerald-500 fill-emerald-500/10" />
          
          </div>
        </span>
      )}
    </h1>
  </div>

</div>

      {/* Working Line */}
      <p className="text-sm sm:text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600 dark:from-slate-300 dark:via-white dark:to-slate-300 italic opacity-80">
        {workingLine}
      </p>

      {/* Position */}
      <p className="text-xs font-black uppercase tracking-widest text-slate-500 pt-1">
        {publicData.position}
      </p>

    </div>
  </div>
</div>


        {/* Separator / Status Bar */}
        <div className={cn(
          "mt-10 flex items-center justify-center md:justify-start gap-4 rounded-2xl px-6 py-4 border backdrop-blur-md shadow-inner",
          isInactive 
            ? "bg-rose-500/5 border-rose-500/10 text-rose-700 dark:text-rose-300" 
            : "bg-emerald-500/5 border-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        )}>
          <div className={cn("h-3 w-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]", isInactive ? "bg-rose-500" : "bg-emerald-500")} />
          <p className="text-[11px] font-black uppercase tracking-[0.2em]">
           Employment Status: <span className="underline underline-offset-4 decoration-2">{isInactive ? 'Inactive' : 'Active'}</span>
          </p>
        </div>

        {/* Tiles Grid: Frosted Separation */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Employee ID", value: publicData.employeeNo, icon: Fingerprint },
            { label: "Department", value: publicData.offices?.name, icon: Building2 },
            { label: "Date Hired", value: startDate ? formatUpdatedAt(startDate) : null, icon: CalendarCheck },
            { label: "Service Tenure", value: tenureLabel, icon: Hourglass }
          ].map((item, idx) => (
            <div key={idx} className="relative group overflow-hidden rounded-3xl border border-white/40 dark:border-white/5 bg-white/40 dark:bg-white/[0.03] p-5 transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="absolute top-0 right-0 p-3 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                {item.icon && <item.icon className="h-8 w-8" />}
              </div>
              <dt className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">{item.label}</dt>
              <dd className="text-sm font-black text-slate-800 dark:text-slate-100">{item.value || "—"}</dd>
            </div>
          ))}
        </div>

        {/* Major Sections: Physical Spacing */}
        <div className="mt-12 space-y-12">
          <section className="relative">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
              <h3 className="shrink-0 text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-3">
                <Trophy className="h-4 w-4 text-[#DA1677]" />
                Gallery of Honors
              </h3>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
            </div>
            <div className="rounded-[32px] bg-slate-50/50 dark:bg-black/20 p-2 sm:p-6 border border-white/20">
               <PublicAwardsGallery employeeId={employeeId} />
            </div>
          </section>

          <section className="relative">
             <div className="flex items-center gap-4 mb-8">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
              <h3 className="shrink-0 text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-3">
                <History className="h-4 w-4 text-indigo-500" />
                Timeline
              </h3>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
            </div>
            <div className="rounded-[32px] bg-slate-50/50 dark:bg-black/20 p-2 border border-white/20">
               <PublicTimeline employeeId={employeeId} />
            </div>
          </section>
        </div>

        {/* Footer: Etched Glass */}
        <footer className="mt-2 pt-8 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
             </div>
             <div className="space-y-0.5">
               <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Identity Authenticated</p>
         
             </div>
          </div>
          
          <div className="text-center sm:text-right space-y-1">
             <p className="text-[11px] font-bold text-slate-400">Last HRMO Audit: {formatUpdatedAt(publicData.updatedAt)}</p>
             <p className="text-[9px] font-medium text-slate-400/60 max-w-[200px] leading-tight">
               Official Public Profile of LGU Lingayen. Privacy protected via Tier-1 encryption.
             </p>
          </div>
        </footer>
      </div>
    </div>
  </div>
</main>

      <section id="self-service" className="rounded-lg border p-4">
        <PublicSelfServiceActions
          employeeId={employeeId}
          employeeType={publicData.employeeType?.name ?? null}
          isActive={publicData.isArchived}
          leaveFormUrl="/files/CSForm6_LeaveApplication.pdf"
          biometricsFolderUrl="https://drive.google.com/drive/folders/1DTrtWmCTOPLYlVdQD_ORZ-j1FoxcUtX1?usp=sharing"
          forms={[
            { label: "Leave Application (CS Form 6)", href: "/files/LeaveForm.docx" },
             { label: "CS Form No. 212, Revised 2025 - Personal Data Sheet ", href: "/files/CS-Form-No.-212-Revised-2025-Personal-Data-Sheet.xlsx" },
            { label: "CS Form No. 212 Attachment - Work Experience Sheet", href: "/files/CS Form No. 212 Attachment - Work Experience Sheet.docx" },
            { label: "DTR Template", href: "/files/DTR Template.xlsm" },
            { label: "SALN Form", href: "/files/SALN Form.doc" },
          ]}
          birthdayPeople={birthdayPeople}
        />
      </section>


      <div id="report-issue">
        <ReportIssueBox
          contactEmail={process.env.NEXT_PUBLIC_HR_CONTACT_EMAIL || "hrmo@lingayen.gov.ph"}
          messengerIdOrUsername={process.env.NEXT_PUBLIC_HR_MESSENGER_ID || "LGULingayenOfficial"}
          employeeName={`${publicData.firstName} ${getMiddleInitial(publicData.middleName)} ${publicData.lastName}`.replace(/\s+/g, " ").trim()}
          employeeNo={publicData.employeeNo}

        />
      </div>

    </div>
  );
}
