// actions/get-employees.ts
import type { Employees } from "../types";
import { getBaseUrl } from "@/lib/base-url";
import { jsonSafe } from "@/lib/http";

type Query = Record<string, string | number | boolean | null | undefined>;

// overload signature
export default async function getEmployees(
  departmentOrQuery: string | Query,
  maybeQuery?: Query
): Promise<Employees[]> {
  const departmentId =
    typeof departmentOrQuery === "string"
      ? departmentOrQuery
      : process.env.HOMEPAGE;

  if (!departmentId) {
    throw new Error(
      "Missing departmentId. Pass it as the first argument or set HOMEPAGE."
    );
  }

  const q: Query =
    typeof departmentOrQuery === "string" ? (maybeQuery ?? {}) : departmentOrQuery;

  const base = getBaseUrl();
  const qs =
    Object.keys(q).length === 0
      ? ""
      : "?" +
        new URLSearchParams(
          Object.entries(q).flatMap(([k, v]) =>
            v === undefined || v === null ? [] : [[k, String(v)]]
          )
        ).toString();

  const res = await fetch(`${base}/api/${departmentId}/employees${qs}`, {
    cache: "no-store",
  });
  return (await jsonSafe<Employees[]>(res)) ?? [];
}
