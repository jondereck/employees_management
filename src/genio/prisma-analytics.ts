import { prisma } from "@/lib/prisma";
import { Gender } from "@prisma/client";

/* ================== HELPERS ================== */

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/* ================== ANALYTICS ================== */

export async function countEmployees(where = {}) {
  return prisma.employee.count({
    where: { isArchived: false, ...where },
  });
}

export async function countByGender(gender: Gender, where = {}) {
  return prisma.employee.count({
    where: { isArchived: false, gender, ...where },
  });
}

export async function countGenderByOffice(officeName: string, gender: Gender) {
  const office = await prisma.offices.findFirst({
    where: { name: { contains: officeName, mode: "insensitive" } },
  });

  if (!office) return null;

  const count = await prisma.employee.count({
    where: {
      officeId: office.id,
      gender,
      isArchived: false,
    },
  });

  return { office: office.name, count };
}

export async function officeWithMostFemales() {
  const result = await prisma.employee.groupBy({
    by: ["officeId"],
    where: { gender: Gender.Female, isArchived: false },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });

  if (!result.length) return null;

  const office = await prisma.offices.findUnique({
    where: { id: result[0].officeId },
    select: { name: true },
  });

  return {
    office: office?.name ?? "Unknown",
    count: result[0]._count.id,
  };
}

export async function departmentWithMostFemales() {
  const result = await prisma.employee.groupBy({
    by: ["departmentId"],
    where: { gender: Gender.Female, isArchived: false },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });

  if (!result.length) return null;

  const dept = await prisma.department.findUnique({
    where: { id: result[0].departmentId },
    select: { name: true },
  });

  return {
    department: dept?.name ?? "Unknown",
    count: result[0]._count.id,
  };
}
