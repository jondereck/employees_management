// app/(dashboard)/[departmentId]/(routes)/(frontend)/view/employee/[employeeId]/page.tsx
import { auth, currentUser } from "@clerk/nextjs/server"; // 👈 add currentUser
import Image from "next/image";

import Gallery from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/gallery";
import getEmployee from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employee";
import getEmployees from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employees";
import Container from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/container";
import Info from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/ui/info";
import Footer from "../../../../../(dashboard)/[departmentId]/(routes)/(frontend)/view/components/footer";
import CameraScannerWrapper from "@/components/camera-scanner-wrapper";
import prismadb from "@/lib/prismadb";
import TogglePublicButton from "@/app/(dashboard)/[departmentId]/(routes)/settings/components/toggle-public-button";

export const revalidate = 0;

// Decide if the visitor is an admin for THIS department
async function resolveIsAdmin(departmentId: string) {
  const { userId } = auth();
  if (!userId) return false;

  // (A) if you later store roles in Clerk publicMetadata.role, honor it:
  const user = await currentUser().catch(() => null);
  const role = (user?.publicMetadata as any)?.role;
  if (role === "admin") return true;

  // (B) department owner is admin
  const dept = await prismadb.department.findUnique({
    where: { id: departmentId },
    select: { userId: true },
  });
  if (dept?.userId === userId) return true;

  // fallback: signed-in ≠ admin
  return false;
}

interface EmployeeInvdividualPageProps {
  params: {
    departmentId: string;
    employeeId: string;
  };
}

export default async function EmployeeInvdividualPage({ params }: EmployeeInvdividualPageProps) {
  // ✅ actually use resolveIsAdmin instead of a missing helper
  const isAdmin = await resolveIsAdmin(params.departmentId);

  if (isAdmin) {
    // 🔐 Admin view (your original UI)
    const employee = await getEmployee(params.employeeId);
    const suggestedPeople = await getEmployees({
      officeId: employee?.offices?.id,
    });

    return (
      <div className="bg-white">
        <Container>
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:gap-x-12">
              {/* Profile Image / Gallery */}
              <div className="w-full max-w-xs mx-auto lg:mx-0">
                <div className="overflow-hidden rounded-xl border shadow-sm bg-white">
                  <Gallery images={employee.images} />
                </div>
              </div>

              {/* Profile Info */}
              <div className="mt-8 lg:mt-0 flex-1">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-6 relative inline-block px-4 sm:px-6 py-2 bg-primary text-white rounded-r-lg shadow-md 
                    before:absolute before:content-[''] before:left-0 before:top-1/2 before:-translate-y-1/2 before:-ml-3 sm:before:-ml-4 
                    before:border-y-[10px] sm:before:border-y-[12px] 
                    before:border-l-[10px] sm:before:border-l-[12px] 
                    before:border-y-transparent before:border-l-primary">
                    Employee Information
                  </h2>
                  <div className="mb-4 flex items-center gap-2">
  <TogglePublicButton
    departmentId={params.departmentId}
    employeeId={employee.id}
    initialEnabled={!!employee.publicEnabled}
  />
  <span className={`text-xs px-2 py-1 rounded-full ${employee.publicEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
    {employee.publicEnabled ? "Public enabled" : "Public disabled"}
  </span>
</div>
                  <Info data={employee} />

                  <div className="flex items-center gap-2 mb-4">
  
</div>
                </div>
              </div>
            </div>

            {/* Optionally include related personnel */}
            {/* <EmployeeList title="Related Personnel" items={suggestedPeople} /> */}
          </div>

          <CameraScannerWrapper />
          <Footer />
        </Container>
      </div>
    );
  }

  // 👇 Public-safe fallback (unauthenticated or non-admin)
  const publicData = await prismadb.employee.findFirst({
    where: {
      id: params.employeeId,
      departmentId: params.departmentId,
      publicEnabled: true,
    },
    select: {
      firstName: true,
      lastName: true,
      employeeNo: true,
      position: true,
      offices: { select: { name: true } },
      images: { select: { url: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  if (!publicData) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Profile not available</h1>
        <p className="text-sm text-muted-foreground">
          This profile is private or the code was revoked.
        </p>
      </div>
    );
  }

  const headshot = publicData.images?.[0]?.url ?? null;

  return (
    <div className="bg-white">

      
      <Container>
        <div className="px-4 py-10 sm:px-6 lg:px-8 mx-auto max-w-xl">
          <div className="flex items-center gap-4">
            {headshot && (
              <Image
                src={headshot}
                alt={`${publicData.firstName} ${publicData.lastName}`}
                width={80}
                height={80}
                className="rounded-xl object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {publicData.firstName} {publicData.lastName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {publicData.position}
                {publicData.offices?.name ? ` • ${publicData.offices.name}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border p-4">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Employee No.</dt>
              <dd className="font-medium">{publicData.employeeNo}</dd>
            </dl>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">Public view</p>
        </div>
      </Container>
    </div>
  );
}
