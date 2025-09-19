import type { Employees } from "../types";
import { apiUrlForEmployee } from "@/utils/api";

const getEmployee = async (departmentId: string, id: string): Promise<Employees | null> => {
  const url = apiUrlForEmployee(departmentId, id);
  const res = await fetch(url, { cache: "no-store" });

  const ct = res.headers.get("content-type") || "";
  if (res.ok && ct.includes("application/json")) {
    return res.json();
  }
  console.error("getEmployee failed:", res.status, await res.text());
  return null;
};

export default getEmployee;