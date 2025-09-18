// actions/get-employee.ts
import type { Employees } from "../types";
import { getBaseUrl } from "@/lib/base-url";
import { jsonSafe } from "@/lib/http";

export default async function getEmployee(departmentId: string, id: string): Promise<Employees | null> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/${departmentId}/employees/${id}`, { cache: "no-store" });
  return jsonSafe<Employees>(res);
}
