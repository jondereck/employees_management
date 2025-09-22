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
                  <Gallery images={employee.images} />
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
      suffix: true,
      employeeNo: true,
      position: true,
      isArchived: true, // 👈 status source (true = inactive)
      dateHired: true,       // 👈 add
      createdAt: true,
      updatedAt: true,
      offices: { select: { name: true } },
      images: { select: { url: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });

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

  const headshot = publicData.images?.[0]?.url ?? null;
  const isInactive = !!publicData.isArchived;
  const isActive = !isInactive;

  function formatUpdatedAt(d?: Date | null) {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(d));
  }

  const orgName = dept?.name || "LGU Lingayen";
  const workingLine = isInactive
    ? `Previously associated with ${orgName}`
    : `Currently working at ${orgName} as`;

  // Years of service (use dateHired if present, else createdAt)
  function yearsBetween(from: Date, to = new Date()) {
    const y = to.getFullYear() - from.getFullYear();
    // Ensure we only count completed years
    const hasHadAnniversary =
      to.getMonth() > from.getMonth() ||
      (to.getMonth() === from.getMonth() && to.getDate() >= from.getDate());
    return hasHadAnniversary ? y : y - 1;
  }

  const startDate = publicData.dateHired ?? publicData.createdAt;
  const yearsOfService =
    startDate ? Math.max(0, yearsBetween(new Date(startDate))) : null;

  function getMiddleInitial(name?: string | null): string {
    if (!name) return "";
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed[0].toUpperCase() + ".";
  }



  return (
    <div className="min-h-screen flex flex-col bg-white">
      <BrandHeader />

      {/* MAIN grows to fill remaining height */}
      <main className="flex-1 bg-[radial-gradient(ellipse_at_top,theme(colors.slate.50),white)]">

        <div className="px-4 py-10 sm:px-6 lg:px-8 mx-auto max-w-xl">
          {/* Header card */}
          <div className="relative overflow-hidden rounded-2xl border shadow-sm bg-white p-5 sm:p-6">
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

            <div className="flex items-start gap-4">
              {/* Photo */}
              <div className="shrink-0">
                {headshot ? (
                  <Image
                    src={headshot}
                    alt={`${publicData.firstName} ${publicData.middleName} ${publicData.lastName} ${publicData.suffix || ""}`}
                    width={88}
                    height={88}
                    className="rounded-xl object-cover aspect-square"
                    priority
                  />
                ) : (
                  <div
                    aria-hidden
                    className="w-[88px] h-[88px] rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs"
                  >
                    No photo
                  </div>
                )}
              </div>

              {/* Name + meta */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold truncate">
                    {publicData.firstName} {getMiddleInitial(publicData.middleName)}{" "}
                    {publicData.lastName} {publicData.suffix || ""}
                  </h1>

                  {/* Public link chip */}
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700"
                    title="This profile is visible via public link."
                  >
                    Public link
                  </span>
                </div>


                <p className="mt-1 text-xs font-light">
                  {workingLine}
                </p>
                <p className="mt-1 text-sm font-bold text-muted-foreground break-words">
                  {publicData.position || "—"}
                </p>
              </div>
            </div>

            {/* Status banner */}
            {isInactive && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Note: This employee is currently <strong>Inactive</strong>.
              </div>
            )}
            {!isInactive && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Note: This employee is currently <strong>Active</strong>.
              </div>
            )}


            {/* Details mini-grid */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <dl className="text-sm">
                  <dt className="text-muted-foreground">Employee No.</dt>
                  <dd className="font-medium">{publicData.employeeNo || "—"}</dd>
                </dl>
              </div>

              <div className="rounded-lg border p-3">
                <dl className="text-sm">
                  <dt className="text-muted-foreground">Office</dt>
                  <dd className="font-medium">{publicData.offices?.name || "—"}</dd>
                </dl>
              </div>

              <div className="rounded-lg border p-3">
                <dl className="text-sm">
                  <dt className="text-muted-foreground">Years of Service</dt>
                  <dd className="font-medium">
                    {typeof yearsOfService === "number" ? `${yearsOfService}+ years` : "—"}
                  </dd>
                </dl>
              </div>
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


      <ReportIssueBox
        contactEmail={process.env.NEXT_PUBLIC_HR_CONTACT_EMAIL || "hrmo@lingayen.gov.ph"}
        messengerIdOrUsername={process.env.NEXT_PUBLIC_HR_MESSENGER_ID || "LGULingayenOfficial"} // your Page username or ID
        employeeName={`${publicData.firstName} ${getMiddleInitial(publicData.middleName)} ${publicData.lastName}`.replace(/\s+/g, " ").trim()}
        employeeNo={publicData.employeeNo}
      />

      <PublicFooter
        systemName="HR Profiling System"
        creatorName="made with ❤️ by Niffy"
        creatorLink="https://www.linkedin.com/in/jdnifas/"
        systemLogo={{ src: "/icon-192x192.png", alt: "HRPS Logo", title: "HR Profiling System" }}
        hrLogo={{ src: "/hrmo-logo.png", alt: "HRMO Logo", title: "Human Resource Management Office" }}
        lguLogo={{ src: "/logo.png", alt: "LGU Lingayen Seal", title: "Municipality of Lingayen" }}
      />
    </div>

  );
}
