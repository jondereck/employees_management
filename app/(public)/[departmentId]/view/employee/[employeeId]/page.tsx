// app/(dashboard)/[departmentId]/(routes)/(frontend)/view/employee/[employeeId]/page.tsx


import { auth, currentUser } from "@clerk/nextjs/server";
import Image from "next/image";
import prismadb from "@/lib/prismadb";

import Gallery from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/gallery";
import getEmployee from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employee";
import getEmployees from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employees";
import Container from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/container";
import Info from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/info";
import Footer from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/footer";
import CameraScannerWrapper from "@/components/camera-scanner-wrapper";
import TogglePublicButton from "@/app/(dashboard)/[departmentId]/(routes)/settings/components/toggle-public-button";
import BrandHeader from "@/components/public/brand-header";
import PublicFooter from "@/components/public/footer";
import ReportIssueBox from "@/components/public/report-issue-box";
import EmployeeList from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/employee-list";
import AdminHeaderCard from "@/app/(public)/components/admin/admin-header-card";
import ActionBar from "@/app/(public)/components/admin/action-bar";
import { use } from "react";
import Timeline from "@/app/(public)/components/timeline";
import AwardsGallery from "@/app/(public)/components/awards-gallery";
import AddTimelineEvent from "@/app/(public)/components/admin/add-timeline-event";
import AddAward from "@/app/(public)/components/admin/add-award";
import PublicTimeline from "@/app/(public)/components/public-timeline";
import PublicAwardsGallery from "@/app/(public)/components/public-awards.gallery";
import PublicSelfServiceActions from "@/app/(public)/components/public-self-service-actions";
import DownloadPhotoButton from "@/app/(public)/components/download-photo";
import PublicHeadshot from "@/app/(public)/components/download-photo";
import { normalizeEducationLines } from "@/utils/normalize-education";
import { ActiveBadge } from "@/app/(public)/components/icons/active-badges";
import AutoTrackPublicView from "@/components/public/auto-track-public-view";


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
    officeId: string;
  };
}

export default async function EmployeeInvdividualPage({ params }: EmployeeInvdividualPageProps) {
  const isAdmin = await resolveIsAdmin(params.departmentId);



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
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:gap-x-12">
              {/* Left: Profile Image / Gallery */}
              <div className="w-full max-w-xs mx-auto lg:mx-0">
                <div className="overflow-hidden rounded-xl border shadow-sm bg-white">

                  <Gallery
                    images={employee.images ?? []}
                    employeeId={employee.id}
                    employeeNo={employee.employeeNo ?? ""} />
                </div>
              </div>

              {/* Right: Profile Info */}
              <div className="mt-8 lg:mt-0 flex-1">
                <AdminHeaderCard
                  departmentId={params.departmentId}
                  employeeId={employee.id}
                  publicEnabled={!!employee.publicEnabled}

                />

                {/* Details card */}
                <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
                  <Info data={employee} />
                </div>
              </div>

            </div>

            {/* Optional: Related personnel */}
            <EmployeeList title="Related Personnel" items={suggestedPeople} />
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
      day: "2-digit",
    }).format(new Date(d));
  }


  const placeholder =
    publicData.gender === "Female" ? "/female_placeholder.png" :
      publicData.gender === "Male" ? "/male_placeholder.png" :
        null;

  const latest = publicData.images?.[0] as PublicImage | undefined;

  const v =
    (latest?.updatedAt && Date.parse(String(latest.updatedAt))) ||
    (latest?.createdAt && Date.parse(String(latest.createdAt))) ||
    Date.now();

  const headshot = latest
    ? `${latest.url}${latest.url.includes("?") ? "&" : "?"}v=${v}`
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
      <main className="flex-1 ">
        <div className="px-4 py-10 sm:px-6 lg:px-8 mx-auto max-w-auto">
          {/* Header card */}
          <div
            className="relative overflow-hidden rounded-2xl border shadow-sm bg-white p-5 sm:p-6"
            style={{
              borderColor: normalizeHex(publicData.employeeType?.value) ?? "#e5e7eb",
              // fallback gray-200 if no color
            }}
          >
            {/* Watermark */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -right-10 -bottom-10 opacity-10">
                <Image
                  src="/logo.png"
                  alt=""
                  width={240}
                  height={240}
                  className="select-none"
                  priority={false}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 border">
              {/* Photo */}
              <div className="shrink-0">
                <PublicHeadshot src={headshot} employeeNo={publicData?.employeeNo} />
              </div>


              {/* Name + meta */}
              <div className="min-w-0 flex-1">
                {/* TOP: Chips */}
                <div className="flex items-center mt-2 gap-2 mb-1">
                  {employmentType && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border"
                      style={buildBadgeStyle(typeHex)}
                      title="Employment Type"
                    >
                      {employmentType}
                    </span>
                  )}
                </div>


                {/* FULL NAME */}
                <div className="relative">
                  {/* one-line, full width, horizontal scroll if needed */}
                  <div
                    className="flex items-center whitespace-nowrap overflow-x-auto pr-1 no-scrollbar"
                    aria-label="Employee name"
                  >
                    <h1 className="font-bold text-sm leading-tight text-[clamp(1rem,3.8vw,1.25rem)] sm:text-[clamp(1.125rem,2vw,1.5rem)]">
                      {fullName}
                    </h1>

                    {!publicData.isArchived && (
                      <span className="shrink-0" title="Active employee" aria-label="Active employee">
                        <ActiveBadge className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="sr-only">Active</span>
                      </span>
                    )}
                  </div>
                </div>
                {/* Working line */}
                <p className="mt-1 text-xs sm:text-md font-light">{workingLine}</p>

                {/* Position */}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm sm:text-md font-bold text-muted-foreground break-words">
                    {publicData.position || "—"}
                  </p>
                </div>
              </div>

            </div>

            {/* Status banner */}
            {isInactive ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                This employee is currently <strong>Inactive</strong>.
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                This employee is currently <strong>Active</strong>.
              </div>
            )}
            <div className="mt-3">
              {/* Auto log a pageview (no UI) */}
              <AutoTrackPublicView
                viewedEmployeeId={params.employeeId}
                departmentId={params.departmentId}
              />

            </div>

            {/* Details mini-grid */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <dl className="text-sm">
                  <dt className="text-muted-foreground">Biometric/Employee No.</dt>
                  <dd className="font-medium">{publicData.employeeNo || "—"}</dd>
                </dl>
              </div>

              <div className="rounded-lg border p-3">
                <dl className="text-sm">
                  <dt className="text-muted-foreground">Office</dt>
                  <dd className="font-medium">{publicData.offices?.name || "—"}</dd>
                </dl>
              </div>

              {/* Optional: show Start Date explicitly (can remove if you don’t want) */}
              <div className="rounded-lg border p-3">
                <dl className="text-sm">
                  <dt className="text-muted-foreground">Start Date</dt>
                  <dd className="font-medium">
                    {startDate ? formatUpdatedAt(startDate) : "—"}
                  </dd>
                </dl>
              </div>
              {/* ⟵ UPDATED: smarter Years of Service */}
              <div className="rounded-lg border p-3">
                <dl className="text-sm">
                  <dt className="text-muted-foreground">Service Rendered</dt>
                  <dd className="font-medium">
                    {tenureLabel}
                    {startDate && tenureLabel !== "—" && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {/* (since {formatDateShort(startDate)}) */}
                      </span>
                    )}
                  </dd>
                </dl>
              </div>
              {/* Eligibility — same UI pattern */}
              {showEligibility && (
                <div className="rounded-lg border p-3">
                  <dl className="text-sm">
                    <dt className="text-muted-foreground">Eligibility</dt>
                    <dd className="font-medium">{eligName}</dd>
                  </dl>
                </div>
              )}

              {/* Educational Attainment — same UI pattern */}
              {showEducation && (
                <div className="rounded-lg border p-3">
                  <dl className="text-sm">
                    <dt className="text-muted-foreground">Educational Attainment</dt>
                    <dd className="font-medium">
                      {eduNormalized.length > 1 ? (
                        <ul className="mt-1 list-disc pl-5 space-y-1">
                          {eduNormalized.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      ) : (
                        eduNormalized[0]
                      )}
                    </dd>
                  </dl>
                </div>
              )}

              <section className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold">Awards & Recognition</h3>
                </div>
                <PublicAwardsGallery employeeId={employeeId} />
              </section>

              <section className="rounded-lg border p-4">
                <PublicTimeline employeeId={employeeId} />
              </section>

            </div>

            <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
              Verified by HRMO • Updated: {formatUpdatedAt(publicData.updatedAt)}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Public view • Some details may be limited for privacy.
            </p>
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
            { label: "PDS Update Form", href: "/files/CS-Form-No.-212-Revised-2025-Personal-Data-Sheet.xlsx" },
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
