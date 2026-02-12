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
<main className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
  {/* Liquid background blobs for a dynamic feel */}
  <div 
    className="absolute top-0 right-0 w-96 h-96 blur-[120px] opacity-20 pointer-events-none rounded-full"
    style={{ backgroundColor: normalizeHex(publicData.employeeType?.value) ?? "#4f46e5" }}
  />

  <div className="px-4 py-10 sm:px-6 lg:px-8  relative z-10">
    {/* Header card: The Main Glass Vessel */}
    <div
      className="relative overflow-hidden rounded-[32px] border backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-6 sm:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] transition-all duration-500"
      style={{
        borderColor: `${normalizeHex(publicData.employeeType?.value) ?? "#e5e7eb"}44`, // 44 adds 25% opacity
      }}
    >
      {/* Watermark: Submerged effect */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -bottom-16 opacity-[0.03] dark:opacity-[0.05] rotate-12">
          <Image
            src="/logo.png"
            alt=""
            width={350}
            height={350}
            className="select-none grayscale"
            priority={false}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
        {/* Photo: Framed with a glass halo */}
        <div className="shrink-0 relative">
          <div className="absolute inset-0 blur-2xl opacity-20 scale-110 rounded-full"
               style={{ backgroundColor: normalizeHex(publicData.employeeType?.value) ?? "#6366f1" }} />
          <PublicHeadshot src={headshot} employeeNo={publicData?.employeeNo} className="ring-4 ring-white/50 dark:ring-white/10 shadow-2xl" />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            {employmentType && (
              <span
                className="inline-flex items-center rounded-xl px-3 py-1 text-[10px] font-bold uppercase tracking-widest border backdrop-blur-md shadow-sm"
                style={buildBadgeStyle(typeHex)}
              >
                {employmentType}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <h1 className="font-black tracking-tight text-slate-900 dark:text-white text-[clamp(1.5rem,5vw,2.25rem)] leading-tight">
                {fullName}
              </h1>
              {!publicData.isArchived && (
                <div className="relative flex items-center justify-center h-6 w-6">
                  <div className="absolute inset-0 bg-green-500/20 blur-md rounded-full animate-ping" />
                  <ActiveBadge className="h-5 w-5 text-green-500 relative z-10" />
                </div>
              )}
            </div>
            <p className="text-sm sm:text-lg font-medium text-slate-500 dark:text-slate-400">{workingLine}</p>
            <p className="text-lg sm:text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-600 to-slate-900 dark:from-white dark:via-slate-400 dark:to-white">
              {publicData.position || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Status banner: Liquid-styled message */}
      <div className={cn(
        "mt-8 flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-semibold border backdrop-blur-md transition-all",
        isInactive 
          ? "bg-rose-500/5 border-rose-500/20 text-rose-700 dark:text-rose-400 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]" 
          : "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]"
      )}>
        <div className={cn("h-2 w-2 rounded-full", isInactive ? "bg-rose-500" : "bg-emerald-500")} />
        This employee is currently <span className="uppercase tracking-wide">{isInactive ? 'Inactive' : 'Active'}</span>
      </div>

      {/* Details mini-grid: Floating frosted tiles */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Employee No.", value: publicData.employeeNo },
          { label: "Office", value: publicData.offices?.name },
          { label: "Start Date", value: startDate ? formatUpdatedAt(startDate) : null },
          { label: "Service Rendered", value: tenureLabel }
        ].map((item, idx) => (
          <div key={idx} className="group rounded-[22px] border border-white/40 dark:border-white/5 bg-white/30 dark:bg-white/[0.02] p-4 transition-all hover:bg-white/50 dark:hover:bg-white/[0.05]">
            <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-1">{item.label}</dt>
            <dd className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.value || "—"}</dd>
          </div>
        ))}
        
        {/* Full width sections for education and awards */}
        <section className="sm:col-span-2 rounded-[24px] border border-white/40 dark:border-white/5 bg-white/20 dark:bg-white/[0.01] p-5">
           <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-400 mb-4 flex items-center gap-2">
            <span className="h-1 w-4 bg-emerald-500 rounded-full" />
            Awards & Recognition
           </h3>
           <PublicAwardsGallery employeeId={employeeId} />
        </section>

        <section className="sm:col-span-2 rounded-[24px] border border-white/40 dark:border-white/5 bg-white/20 dark:bg-white/[0.01] p-5">
           <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-400 mb-4 flex items-center gap-2">
            <span className="h-1 w-4 bg-indigo-500 rounded-full" />
            Service History
           </h3>
           <PublicTimeline employeeId={employeeId} />
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-white/20 dark:border-white/5 flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Verified by HRMO</p>
          <p className="text-[11px] text-muted-foreground">Updated: {formatUpdatedAt(publicData.updatedAt)}</p>
        </div>
        <p className="text-[11px] italic text-muted-foreground self-end opacity-60">
          Some details may be limited for privacy.
        </p>
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
