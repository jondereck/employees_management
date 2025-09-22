// lib/actions/get-employees.ts
import qs from "query-string";
import type { Employees } from "../types";

// ✅ departmentId is OPTIONAL now (and we won't use it if NEXT_PUBLIC_API_URL already includes it)
interface Query {
  // departmentId?: string; // <- you can delete this line entirely if you want
  officeId?: string;
  employeeTypeId?: string;
  eligibilityId?: string;
  isFeatured?: boolean;
  status?: "all" | "active" | "archived";
  isArchived?: boolean; // back-compat
}

const BASE = `${process.env.NEXT_PUBLIC_API_URL}`; // e.g. /api/<deptId> or http://localhost:3000/api/<deptId>

const getEmployees = async (query: Query = {}): Promise<Employees[]> => {
  // Since BASE already has /api/<departmentId>, just append /employees
  const url = qs.stringifyUrl({
    url: `${BASE}/employees`,
    query: {
      officeId: query.officeId,
      employeeTypeId: query.employeeTypeId,
      eligibilityId: query.eligibilityId,
      isFeatured: query.isFeatured,
      status: query.status,          // API defaults to "all" if omitted
      isArchived: query.isArchived,  // optional legacy
    },
  });

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
};

export default getEmployees;
