import { prisma } from "@/lib/prisma";


function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\b(office|department|management)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type EmployeeAIView = {
  id: string;
  name: string;
  department: string;
  office: string;
  employeeType: string;
  gender?: string;
  age?: number;
};

function calculateAge(birthday?: Date | null) {
  if (!birthday) return undefined;
  return Math.floor(
    (Date.now() - birthday.getTime()) / 31557600000
  );
}

export async function getEmployeesForAI() {
  const employees = await prisma.employee.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      birthday: true,
      department: { select: { name: true } },
      offices: { select: { name: true } },
      employeeType: { select: { name: true } },
    },
  });

  return employees.map(e => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    department: e.department?.name ?? "Unknown",
    office: e.offices?.name ?? "Unknown",
    employeeType: e.employeeType?.name ?? "Unknown",
    gender: e.gender ?? undefined,
    age: calculateAge(e.birthday),
  }));
}


export function buildEmployeeAIContext(
  employees: EmployeeAIView[],
  limit = 40
) {
  return employees
    .slice(0, limit)
    .map(e => `
Name: ${e.name}
Office: ${normalizeText(e.office)}
Department: ${normalizeText(e.department)}
Employee Type: ${e.employeeType}
Gender: ${e.gender ?? "Unknown"}
Age: ${e.age ?? "Unknown"}
`)
    .join("\n---\n");
}
