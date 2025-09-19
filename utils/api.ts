export function getBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return "";
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

// list endpoint
export function apiUrlForEmployees(
  departmentId: string,
  filters?: URLSearchParams | Record<string, any>
) {
  const base = getBaseUrl();
  const params = filters instanceof URLSearchParams ? filters : new URLSearchParams();
  if (!(filters instanceof URLSearchParams) && filters)
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  const query = params.toString() ? `?${params.toString()}` : "";
  const path = `/api/${departmentId}/employees${query}`;
  return base ? `${base}${path}` : path;
}

// single item endpoint
export function apiUrlForEmployee(departmentId: string, employeeId: string) {
  const base = getBaseUrl();
  const path = `/api/${departmentId}/employees/${employeeId}`;
  return base ? `${base}${path}` : path;
}


