
import { splitEmployeeNo } from "@/lib/bio-utils";
import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs/server"; // ⬅️ server import
import { NextResponse } from "next/server";

// helper: respect local calendar day, then pin to 12:00 UTC
function toUTCNoonFromLocalDate(d: Date) {
  const y = d.getFullYear();   // local parts (avoid off-by-one)
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(y, m, day, 12, 0, 0)); // 12:00Z
}

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

    // Before creating/updating employee:
const { bio } = splitEmployeeNo(body.employeeNo);
if (bio) {
  const exists = await prismadb.employee.findFirst({
    where: {
      officeId: body.officeId,
      employeeNo: { startsWith: bio }, // safer: parse-and-compare bio exactly
    },
    select: { id: true },
  });
  if (exists) {
    return new NextResponse("BIO already taken in this office. Please click Suggest again.", { status: 409 });
  }
}


    // --- CREATE employee + default HIRED event atomically ---
    const created = await prismadb.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          departmentId: params.departmentId,
          prefix,
          employeeNo,
          lastName,
          firstName,
          middleName,
          suffix,
          images: {
            createMany: { data: images.map((img: { url: string }) => img) },
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
          salary: autoSalary, // or use `salary ?? autoSalary` if you allow override
          dateHired: dateHired ? new Date(dateHired) : new Date(),
          latestAppointment,
          isFeatured,
          isArchived,
          isHead,
          employeeTypeId,
          officeId,
          eligibilityId,
          salaryGrade: salaryGrade != null ? Number(salaryGrade) : 0,
          salaryStep:  salaryStep  != null ? Number(salaryStep)  : 0,
          memberPolicyNo,
          age,
          nickname,
          emergencyContactName,
          emergencyContactNumber,
          employeeLink,
          note: note ?? null,
          designationId: designationId ?? null,
        },
        include: {
          designation: { select: { id: true, name: true } },
          images: true,
          offices: { select: { name: true } },        // ⬅️ for details
          employeeType: { select: { name: true } },   // ⬅️ for details
        },
      });

      // default HIRED event (no approval)
      const occurredAt = toUTCNoonFromLocalDate(employee.dateHired);
      const details = `Hired as ${employee.position} (${employee.employeeType?.name ?? "—"}) in ${employee.offices?.name ?? "—"}.`;

      await tx.employmentEvent.create({
        data: {
          employeeId: employee.id,
          type: "HIRED",
          occurredAt, // noon-UTC to avoid off-by-one
          details,
        },
      });

      return employee;
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
        images: true,
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
