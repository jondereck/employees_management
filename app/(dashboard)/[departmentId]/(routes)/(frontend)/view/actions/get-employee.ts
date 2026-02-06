// app/(dashboard)/[departmentId]/(routes)/(frontend)/view/actions/get-employee.ts
import { Employees } from "../types";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/employees`;

const ts = (x: any) => new Date(x ?? 0).getTime();

const getEmployee = async (id: string): Promise<Employees> => {
  const res = await fetch(`${URL}/${id}`, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });

  if (!res.ok) throw new Error("Failed to load employee");

  const data: any = await res.json();

  /* -------------------- IMAGES (unchanged logic) -------------------- */
  const sortedImages = Array.isArray(data.images)
    ? [...data.images].sort(
        (a, b) =>
          ts(b?.updatedAt ?? b?.createdAt) -
          ts(a?.updatedAt ?? a?.createdAt)
      )
    : [];

  const images = sortedImages.map((img: any) => {
    const ver = ts(img?.updatedAt ?? img?.createdAt);
    if (img.url)
      return {
        ...img,
        url: `${img.url}${img.url.includes("?") ? "&" : "?"}v=${ver}`,
      };
    if (img.src)
      return {
        ...img,
        src: `${img.src}${img.src.includes("?") ? "&" : "?"}v=${ver}`,
      };
    return img;
  });

  /* -------------------- NEW: SAFE RELATION NORMALIZATION -------------------- */

  const workSchedules = Array.isArray(data.workSchedules)
    ? [...data.workSchedules].sort(
        (a, b) => ts(b?.effectiveFrom) - ts(a?.effectiveFrom)
      )
    : [];

  const awards = Array.isArray(data.awards)
    ? [...data.awards]
        .filter((a) => !a?.deletedAt)
        .sort((a, b) => ts(b?.givenAt) - ts(a?.givenAt))
    : [];

  const employmentEvents = Array.isArray(data.employmentEvents)
    ? [...data.employmentEvents]
        .filter((e) => !e?.deletedAt)
        .sort((a, b) => ts(b?.occurredAt) - ts(a?.occurredAt))
    : [];

  /* -------------------- RETURN (EXPLICIT + SAFE) -------------------- */
  return {
    ...(data as Employees),

    // 🔐 QR / PUBLIC FIELDS (unchanged)
    publicId: data.publicId,
    publicVersion: data.publicVersion,
    publicEnabled: data.publicEnabled,
    legacyQrAllowed: data.legacyQrAllowed,

    // 🖼 images
    images,

    // 🆕 preview-ready relations
    workSchedules,
    awards,
    employmentEvents,
  };
};

export default getEmployee;
