

import { findFirstFreeBioFlat } from "@/lib/bio-utils";
import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs/server"; // ⬅️ server import
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

// helper: respect local calendar day, then pin to 12:00 UTC
function toUTCNoonFromLocalDate(d: Date) {
  const y = d.getFullYear();   // local parts (avoid off-by-one)
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(y, m, day, 12, 0, 0)); // 12:00Z
}
const employeeInclude = {
  designation: { select: { id: true, name: true } },
  images: true,
  offices: { select: { name: true } },
  employeeType: { select: { name: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithIncludes = Prisma.EmployeeGetPayload<{
  include: typeof employeeInclude;
}>;

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { userId } = auth();
    const body = await req.json();

    const {
      prefix,
      employeeNo,
      lastName,
      firstName,
      middleName,
      suffix,
      images = [], // ⬅️ default to []
      gender,
      contactNumber,
      position,
      birthday,
      education,
      region,
      houseNo,
      street,
      barangay,
      city,
      province,
      gsisNo,
      tinNo,
      pagIbigNo,
      philHealthNo,
      salary,
      dateHired,
      latestAppointment,
      isFeatured,
      isArchived,
      isHead,
      employeeTypeId,
      officeId,
      eligibilityId,
      salaryGrade,
      salaryStep,
      memberPolicyNo,
      age,
      nickname,
      emergencyContactName,
      emergencyContactNumber,
      employeeLink,
      note,
      designationId,
    } = body;

    // --- your existing validations (kept as-is, tiny touch-ups) ---
    const urlRegex = /^https:\/\/drive\.google\.com\/.*$/;

    if (!userId) return new NextResponse("Unauthenticated", { status: 401 });
    if (!firstName) return new NextResponse("First Name is required", { status: 400 });
    if (!lastName) return new NextResponse("Last Name is required", { status: 400 });
    if (!position) return new NextResponse("Position is required", { status: 400 });
    if (!officeId) return new NextResponse("Office is required", { status: 400 });
    if (!employeeTypeId) return new NextResponse("Appointment is required", { status: 400 });
    if (!eligibilityId) return new NextResponse("Eligibility Id is required", { status: 400 });

    const is11 = (v: string) => /^\d{11}$/.test(v);
    if ((contactNumber && !is11(contactNumber)) || (emergencyContactNumber && !is11(emergencyContactNumber))) {
      return new NextResponse(JSON.stringify({ error: "Contact numbers must be 11 digits" }), { status: 400 });
    }
    if (employeeLink && !urlRegex.test(employeeLink)) {
      return new NextResponse(JSON.stringify({ error: "Invalid URL format for employee link" }), { status: 400 });
    }
    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });
    if (!departmentByUserId) return new NextResponse("Unauthorized", { status: 403 });

    const alreadyExist = await prismadb.employee.findFirst({
      where: {
        departmentId: params.departmentId,
        lastName,
        firstName,
      },
      select: { id: true },
    });
    if (alreadyExist) {
      return new NextResponse(JSON.stringify({ error: "Employee already exists." }), { status: 400 });
    }

    if (contactNumber) {
      const contactNumberExists = await prismadb.employee.findFirst({
        where: { departmentId: params.departmentId, contactNumber },
        select: { id: true },
      });
      if (contactNumberExists) {
        return new NextResponse(JSON.stringify({ error: "Contact number already exists." }), { status: 400 });
      }
    }

    if (designationId) {
      const validDesignation = await prismadb.offices.findFirst({
        where: { id: designationId, departmentId: params.departmentId },
        select: { id: true },
      });
      if (!validDesignation) {
        return new NextResponse(JSON.stringify({ error: "Invalid designationId (Office not in this department)" }), { status: 400 });
      }
    }

    // compute auto salary from grade/step
    let autoSalary = 0;
    if (salaryGrade != null && salaryStep != null) {
      const salaryRecord = await prismadb.salary.findUnique({
        where: { grade_step: { grade: Number(salaryGrade), step: Number(salaryStep) } },
        select: { amount: true },
      });
      autoSalary = salaryRecord?.amount ?? 0;
    }


    const normalizeBio = (v?: string | null) => (v ?? "").replace(/[^\d]/g, "");
    // --- CREATE employee + default HIRED event atomically (with collision-safe BIO) ---
    const created = await prismadb.$transaction(async (tx) => {
      // 1) If employeeNo was not provided, try to auto-suggest from the office.bioIndexCode
      const office = await tx.offices.findUnique({
        where: { id: officeId },
        select: { bioIndexCode: true },
      });

      let employeeNoFinal = normalizeBio(employeeNo);

      async function suggestIfNeeded() {
        if (!employeeNoFinal && office?.bioIndexCode && /^\d+$/.test(office.bioIndexCode)) {
          const anchor = Number(office.bioIndexCode);

          // Choose your “family” range. Example below = same 1k block (2050000..2050999)
          const familyStart = Math.floor(anchor / 1000) * 1000;
          const familyEnd = familyStart + 999;

          employeeNoFinal = await findFirstFreeBioFlat({
            departmentId: params.departmentId,
            startFrom: anchor,                // start candidate = anchor+1 (see allowStart=false)
            allowStart: false,                // try anchor+1, then +2, etc.
            digits: office.bioIndexCode.length, // keep width (e.g., 7 digits)
            familyStart,
            familyEnd,
          });
        }
      }

      await suggestIfNeeded();
      // 2) Create with small retry loop to handle unique collisions on (departmentId, employeeNo)
      //    (requires @@unique([departmentId, employeeNo]) in your Prisma schema)
      let employeeRow: EmployeeWithIncludes | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          employeeRow = await tx.employee.create({
            data: {
              departmentId: params.departmentId,
              prefix,
              employeeNo: employeeNoFinal || undefined, // pure digits, no suffix
              lastName,
              firstName,
              middleName,
              suffix,
              images: {
                createMany: { data: (images ?? []).map((img: { url: string }) => ({ url: img.url })) },
              },
              gender,
              contactNumber,
              position,
              birthday,
              education,
              region,
              houseNo,
              street,
              barangay,
              city,
              province,
              gsisNo,
              tinNo,
              pagIbigNo,
              philHealthNo,
              salary: autoSalary,
              dateHired: dateHired ? new Date(dateHired) : new Date(),
              latestAppointment,
              isFeatured,
              isArchived,
              isHead,
              employeeTypeId,
              officeId,
              eligibilityId,
              salaryGrade: salaryGrade != null ? Number(salaryGrade) : 0,
              salaryStep: salaryStep != null ? Number(salaryStep) : 0,
              memberPolicyNo,
              age,
              nickname,
              emergencyContactName,
              emergencyContactNumber,
              employeeLink,
              note: note ?? null,
              designationId: designationId ?? null,
              publicEnabled: true,
            },
            include: employeeInclude,
          });
          break; // success
        } catch (e: any) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002" &&
            (e.meta?.target as string[] | undefined)?.includes("departmentId") &&
            (e.meta?.target as string[] | undefined)?.includes("employeeNo")
          ) {
            // 🔁 On collision, re-suggest then retry
            employeeNoFinal = "";
            await suggestIfNeeded();
            continue;
          }
          throw e;
        }
      }



      if (!employeeRow) throw new Error("Failed to create employee after retries");

      // 3) Default HIRED event (noon-UTC to avoid off-by-one timelines)
      const occurredAt = toUTCNoonFromLocalDate(employeeRow.dateHired);
      const details = `Hired as ${employeeRow.position} (${employeeRow.employeeType?.name ?? "—"}) in ${employeeRow.offices?.name ?? "—"}.`;

      await tx.employmentEvent.create({
        data: {
          employeeId: employeeRow.id,
          type: "HIRED",
          occurredAt,
          details,
        },
      });

      return employeeRow;
    });

    return NextResponse.json(created);

  } catch (error) {
    console.log("[EMPLOYEE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const { searchParams } = new URL(req.url);

    // filters (all optional)
    const officeId = searchParams.get("officeId") || undefined;
    const employeeTypeId = searchParams.get("employeeTypeId") || undefined;
    const eligibilityId = searchParams.get("eligibilityId") || undefined;

    // booleans: pass `?isFeatured=1` or `?isFeatured=true`
    const isFeaturedParam = searchParams.get("isFeatured");
    const isHeadParam = searchParams.get("isHead");
    const isFeatured =
      isFeaturedParam === "1" || isFeaturedParam === "true" ? true :
        isFeaturedParam === "0" || isFeaturedParam === "false" ? false :
          undefined;
    const isHead =
      isHeadParam === "1" || isHeadParam === "true" ? true :
        isHeadParam === "0" || isHeadParam === "false" ? false :
          undefined;

    // status: all | active | archived (default: all)
    const status = (searchParams.get("status") ?? "all").toLowerCase() as
      | "all" | "active" | "archived";

    // simple search term (optional): `?q=...`
    const q = (searchParams.get("q") || "").trim();

    // build where
    const where: any = {
      departmentId: params.departmentId,
      officeId,
      employeeTypeId,
      eligibilityId,
      // Only set isFeatured/isHead if they’re explicitly boolean
      ...(typeof isFeatured === "boolean" ? { isFeatured } : {}),
      ...(typeof isHead === "boolean" ? { isHead } : {}),
    };

    if (status === "active") where.isArchived = false;
    if (status === "archived") where.isArchived = true;
    // status === "all" -> do not set isArchived

    if (q) {
      where.OR = [
        { employeeNo: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { middleName: { contains: q, mode: "insensitive" } },
        { position: { contains: q, mode: "insensitive" } },
        { contactNumber: { contains: q, mode: "insensitive" } },
        // add more fields as you need
      ];
    }

    const employees = await prismadb.employee.findMany({
      where,
      include: {
        images: {
    select: { id: true, url: true, createdAt: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  },
        offices: true,
        employeeType: true,
        eligibility: true,
        designation: { select: { id: true, name: true } },

      },
      orderBy: {
        updatedAt: "desc", // better for realtime UI
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.log("[EMPLOYEES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
