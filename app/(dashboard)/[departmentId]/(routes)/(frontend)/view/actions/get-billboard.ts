// actions/get-billboard.ts  (no "use server" needed)
import { apiUrlForBillboard } from "@/utils/api";

export default async function getBillboard(departmentId: string, id: string) {
  if (!departmentId) throw new Error("[GET_BILLBOARD] departmentId is missing");
  if (!id)           throw new Error("[GET_BILLBOARD] billboardId is missing");

  const url = apiUrlForBillboard(departmentId, id);

  const res  = await fetch(url, { next: { revalidate: 60 }, headers: { accept: "application/json" } });
  const body = await res.text();
  if (!res.ok) throw new Error(`[GET_BILLBOARD] ${res.status} ${body.slice(0,200)}`);

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`[GET_BILLBOARD] Expected JSON, got "${ct}". First 200 chars:\n${body.slice(0,200)}`);
  }
  return JSON.parse(body);
}
