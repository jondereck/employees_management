import { format } from "date-fns";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CelebrationView, type CelebrationEntry } from "@/components/celebration-view";
import { EmployeesColumn } from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/columns";
import prismadb from "@/lib/prismadb";

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

export default async function RetirementsPage({
  params,
}: {
  params: { departmentId: string };
}) {
  const { departmentId } = params;
  const today = new Date();
  const currentYear = today.getFullYear();

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
    if (!employee.birthday) continue;

    const birthDate = new Date(employee.birthday);
    if (Number.isNaN(birthDate.getTime())) continue;

    const retirementYear = birthDate.getFullYear() + 65;
    if (retirementYear > currentYear) continue;
    const retirementDate = new Date(retirementYear, birthDate.getMonth(), birthDate.getDate());
    const isUpcoming = retirementYear === currentYear && retirementDate >= today;

    let serviceYears: number | null = null;
    if (employee.dateHired) {
      const hireDate = new Date(employee.dateHired);
      if (!Number.isNaN(hireDate.getTime())) {
        serviceYears = retirementYear - hireDate.getFullYear();
        const serviceAnniversary = new Date(retirementYear, hireDate.getMonth(), hireDate.getDate());
        if (serviceAnniversary > retirementDate) serviceYears -= 1;
        if (serviceYears < 0) serviceYears = 0;
      }
    }
    if (serviceYears == null || serviceYears < 10) continue;

    const dayDiff = Math.ceil((retirementDate.getTime() - today.getTime()) / MS_PER_DAY);
    const daysLeft = Math.max(0, dayDiff);

    const displayName = employee.nickname
      ? `${employee.firstName} "${employee.nickname}" ${employee.lastName}`
      : fullNameFromParts(employee);

    const status: "upcoming" | "completed" = isUpcoming ? "upcoming" : "completed";

    const highlight = status === "upcoming"
      ? (daysLeft === 0 ? "Today" : shortDateFormatter.format(retirementDate))
      : `Retired ${retirementYear}`;

    const primaryLabel = isUpcoming
      ? `Retires on ${longDateFormatter.format(retirementDate)}`
      : `Retired on ${longDateFormatter.format(retirementDate)}`;

    const secondaryParts: string[] = [];
    if (status === "upcoming") {
      secondaryParts.push(
        daysLeft === 0
          ? "Turns 65 today"
          : `Turns 65 in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
      );
    } else {
      secondaryParts.push(`Turned 65 on ${shortDateFormatter.format(retirementDate)}`);
    }
    if (serviceYears != null) {
      secondaryParts.push(`${serviceYears} year${serviceYears === 1 ? "" : "s"} of service`);
    }
    const secondaryLabel = secondaryParts.join(" | ");

    entries.push({
      id: employee.id,
      fullName: displayName,
      primaryLabel,
      secondaryLabel,
      badge: "Age 65",
      highlight,
      status,
      eventDate: retirementDate.toISOString(),
      imageUrl: employee.images[0]?.url ?? null,
      previewData: mapEmployeeToColumn(employee),
    });
  }

  const sorted = entries.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "upcoming" ? -1 : 1;
    }
    const aTime = new Date(a.eventDate).getTime();
    const bTime = new Date(b.eventDate).getTime();
    if (a.status === "upcoming") {
      return aTime - bTime;
    }
    return bTime - aTime;
  });

  const upcomingCount = sorted.filter((entry) => entry.status === "upcoming").length;
  const completedCount = sorted.filter((entry) => entry.status === "completed").length;

  const subtitle = sorted.length
    ? `${upcomingCount} upcoming | ${completedCount} completed retirement${completedCount === 1 ? "" : "s"}`
    : "No employees turning 65 in the current cycle.";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: "Employees", href: `/${departmentId}/employees` },
          { label: "Retirements" },
        ]}
      />

      <CelebrationView
        title="Upcoming Retirements"
        subtitle={subtitle}
        description="Review who is scheduled to retire so you can plan endorsements, clearances, and turnover activities."
        emptyMessage="No matching retirements. Check birth dates or explore the Completed tab for retirement history."
        people={sorted}
        employeeTypes={[]}
         enableDownload={true}
        defaultFilter="upcoming"
      />
    </div>
  );
}
