
import { format } from "date-fns";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CelebrationView, type CelebrationEntry } from "@/components/celebration-view";
import { EmployeesColumn } from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/columns";
import prismadb from "@/lib/prismadb";

const MILESTONE_YEARS = [10, 15, 20, 25, 30, 35, 40];

const milestoneDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const fullNameFromParts = (employee: any) => {
  const parts = [
    employee.prefix?.trim(),
    employee.firstName?.trim(),
    employee.middleName?.trim(),
    employee.lastName?.trim(),
    employee.suffix?.trim(),
  ].filter(Boolean);
  return parts.join(" ");
};

const formatNullableDate = (value?: Date | string | null) =>
  value ? format(new Date(value), "M d, yyyy") : "";

const mapEmployeeToColumn = (employee: any): EmployeesColumn => ({
  id: employee.id,
  employeeNo: employee.employeeNo ?? "",
  department: employee.departmentId ?? "",

  // 🔐 QR / PUBLIC FIELDS (ADD THESE)
  publicId: employee.publicId ?? "",
  publicVersion: Number(employee.publicVersion ?? 0),
  publicEnabled: Boolean(employee.publicEnabled),

  prefix: employee.prefix ?? "",
  lastName: employee.lastName ?? "",
  firstName: employee.firstName ?? "",
  middleName: employee.middleName ?? "",
  suffix: employee.suffix ?? "",
  gender: employee.gender ?? "",
  contactNumber: employee.contactNumber ?? "",
  position: employee.position ?? "",
  birthday: formatNullableDate(employee.birthday),
  education: employee.education ?? "",
  gsisNo: employee.gsisNo ?? "",
  tinNo: employee.tinNo ?? "",
  philHealthNo: employee.philHealthNo ?? "",
  pagIbigNo: employee.pagIbigNo ?? "",
  memberPolicyNo: employee.memberPolicyNo ?? "",
  salaryGrade: employee.salaryGrade?.toString() ?? "",
  salaryStep: employee.salaryStep?.toString() ?? "",
  salary: employee.salary != null ? String(employee.salary) : "",
  salaryMode: employee.salaryMode ?? "AUTO",
  dateHired: formatNullableDate(employee.dateHired),
  latestAppointment: employee.latestAppointment ?? "",
  terminateDate: employee.terminateDate ?? "",
  isFeatured: Boolean(employee.isFeatured),
  isHead: Boolean(employee.isHead),
  isArchived: Boolean(employee.isArchived),

  eligibility: employee.eligibility
    ? {
        id: employee.eligibility.id,
        name: employee.eligibility.name,
        value: employee.eligibility.value,
      }
    : { id: "", name: "", value: "" },

  employeeType: employee.employeeType
    ? {
        id: employee.employeeType.id,
        name: employee.employeeType.name,
        value: employee.employeeType.value,
      }
    : { id: "", name: "", value: "" },

  offices: employee.offices
    ? {
        id: employee.offices.id,
        name: employee.offices.name,
      }
    : { id: "", name: "" },

  images: Array.isArray(employee.images)
    ? employee.images.map((image: any) => ({
        id: image.id,
        url: image.url,
        value: "",
      }))
    : [],

  region: employee.region ?? "",
  province: employee.province ?? "",
  city: employee.city ?? "",
  barangay: employee.barangay ?? "",
  houseNo: employee.houseNo ?? "",
  age: employee.age ?? "",
  nickname: employee.nickname ?? "",
  emergencyContactName: employee.emergencyContactName ?? "",
  emergencyContactNumber: employee.emergencyContactNumber ?? "",
  employeeLink: employee.employeeLink ?? "",
  note: employee.note ?? "",

  designation: employee.designation
    ? {
        id: employee.designation.id,
        name: employee.designation.name,
      }
    : null,

  createdAt: employee.createdAt ? employee.createdAt.toISOString() : null,
  updatedAt: employee.updatedAt ? employee.updatedAt.toISOString() : null,
});



export const revalidate = 1800;

export default async function AnniversariesPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  const today = new Date();
  const currentYear = today.getFullYear();

  
const employeeTypes = await prismadb.employeeType.findMany({
  where: {
    departmentId,
  },
  orderBy: {
    name: "asc",
  },
});

  const employees = await prismadb.employee.findMany({
    where: { departmentId },
    include: {
      offices: true,
      employeeType: true,
      eligibility: true,
      designation: { select: { id: true, name: true } },
      images: {
        orderBy: [
          { updatedAt: "desc" },
          { createdAt: "desc" },
        ],
        select: { id: true, url: true, createdAt: true, updatedAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const entries: CelebrationEntry[] = [];

 for (const employee of employees) {
  if (!employee.dateHired) continue;

  const hireDate = new Date(employee.dateHired);
  if (Number.isNaN(hireDate.getTime())) continue;

  for (const milestone of MILESTONE_YEARS) {
    const milestoneYear = hireDate.getFullYear() + milestone;

    // do not create future milestones
    if (milestoneYear > currentYear) continue;

    const milestoneDate = new Date(
      milestoneYear,
      hireDate.getMonth(),
      hireDate.getDate()
    );

    const status: "upcoming" | "completed" =
      milestoneDate >= today ? "upcoming" : "completed";

    const highlight =
      status === "completed"
        ? "Completed"
        : shortDateFormatter.format(milestoneDate);

    const displayName = employee.nickname
      ? `${employee.firstName} "${employee.nickname}" ${employee.lastName}`
      : fullNameFromParts(employee);

    const primaryLabel =
      status === "completed"
        ? `${milestone}-year milestone celebrated`
        : `${milestone}-year milestone`;

    const secondaryLabel = `${
      status === "completed" ? "Celebrated on" : "Scheduled for"
    } ${milestoneDateFormatter.format(milestoneDate)} • Hired ${milestoneDateFormatter.format(
      hireDate
    )}`;

    entries.push({
      id: `${employee.id}-${milestoneYear}`, // 👈 unique per year
      fullName: displayName,
      primaryLabel,
      secondaryLabel,
      badge: `${milestone} Years`,
      highlight,
      status,
      eventDate: milestoneDate.toISOString(),
      imageUrl: employee.images[0]?.url ?? null,
      previewData: mapEmployeeToColumn(employee),
    });
  }
}

  const sorted = entries.sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  const upcomingCount = sorted.filter((entry) => entry.status === "upcoming").length;
  const completedCount = sorted.filter((entry) => entry.status === "completed").length;

  const subtitle = sorted.length
    ? `${upcomingCount} upcoming · ${completedCount} completed milestone${completedCount === 1 ? "" : "s"}`
    : "Track upcoming 10, 15, 20-year (and beyond) milestone anniversaries.";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: "Employees", href: `/${departmentId}/employees` },
          { label: "Loyalty Awards" },
        ]}
      />

      <CelebrationView
        title="Loyalty Awardees"
        subtitle={subtitle}
        description="Monitor landmark years of service so you can plan recognition activities ahead of time."
        emptyMessage="No milestone Loyalty Awardees detected for this period. Update employee hire dates to track key milestones."
        people={sorted}
        employeeTypes={employeeTypes}
        enableDownload={true}
        defaultFilter="upcoming"
      />
    </div>
  );
}
