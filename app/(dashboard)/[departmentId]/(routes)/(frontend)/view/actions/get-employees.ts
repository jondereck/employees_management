// actions/get-employees.ts
import type { Employees } from "../types";
import { getBaseUrl } from "@/lib/base-url";
import { jsonSafe } from "@/lib/http";

export default async function getEmployees(
  departmentId: string,
  q?: Record<string, string | number | boolean | null | undefined>
): Promise<Employees[]> {
  const base = getBaseUrl();
  const qs = q
    ? "?" +
      new URLSearchParams(
        Object.entries(q).flatMap(([k, v]) =>
          v === undefined || v === null ? [] : [[k, String(v)]]
        )
      ).toString()
    : "";
  const res = await fetch(`${base}/api/${departmentId}/employees${qs}`, { cache: "no-store" });
  return (await jsonSafe<Employees[]>(res)) ?? [];
}
