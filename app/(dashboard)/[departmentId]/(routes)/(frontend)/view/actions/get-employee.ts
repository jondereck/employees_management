// app/(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employee.ts
import { Employees } from "../types";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/employees`;

const ts = (x: any) => new Date(x ?? 0).getTime();

const getEmployee = async (id: string): Promise<Employees> => {
  const res = await fetch(`${URL}/${id}`, {
    cache: "no-store",                   // ← no page cache
    headers: { "cache-control": "no-cache" },
  });
  if (!res.ok) throw new Error("Failed to load employee");
  const data: Employees = await res.json();

  // sort newest first
  const sorted = Array.isArray((data as any).images)
    ? [...(data as any).images].sort(
        (a, b) => ts(b?.updatedAt ?? b?.createdAt) - ts(a?.updatedAt ?? a?.createdAt)
      )
    : [];

  // cache-bust URLs (works even if filename didn’t change)
  const images = sorted.map((img: any) => {
    const ver = ts(img?.updatedAt ?? img?.createdAt);
    // support either `url` or `src` field—keep whichever you use
    if (img.url) return { ...img, url: `${img.url}${img.url.includes("?") ? "&" : "?"}v=${ver}` };
    if (img.src) return { ...img, src: `${img.src}${img.src.includes("?") ? "&" : "?"}v=${ver}` };
    return img;
  });

  return { ...(data as any), images } as Employees;
};

export default getEmployee;
