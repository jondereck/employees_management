

import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {


    const { userId } = auth();
    const body = await req.json()

    const {
      prefix,
      employeeNo,
      lastName,
      firstName,
      middleName,
      suffix,
      images,
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
      // zipCode,
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


    let autoSalary = 0;
    if (salaryGrade && salaryStep) {
      const salaryRecord = await prismadb.salary.findUnique({
        where: {
          grade_step: {
            grade: Number(salaryGrade),
            step: Number(salaryStep),
          },
        },
      });

      autoSalary = salaryRecord?.amount ?? 0;
    }

    const urlRegex = /^https:\/\/drive\.google\.com\/.*$/;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });

    }

    if (!firstName) {
      return new NextResponse("First Name is required", { status: 400 })
    }
    if (!lastName) {
      return new NextResponse("Last Name is required", { status: 400 })
    }
    // if (!middleName) {
    //   return new NextResponse("Middle Name is required", { status: 400 })
    // }
    if (!position) {
      return new NextResponse("Position is required", { status: 400 })
    }
    // if (!contactNumber) {
    //   return new NextResponse("Contact Number is required", { status: 400 })
    // }
    if (!officeId) {
      return new NextResponse("Office url is required", { status: 400 })
    }
    if (!employeeTypeId) {
      return new NextResponse("Appointment is required", { status: 400 })
    }
    if (!eligibilityId) {
      return new NextResponse("Eligibility Id is required", { status: 400 })
    }

    if (contactNumber && contactNumber.length !== 11 || emergencyContactNumber && emergencyContactNumber.length !== 11) {
      return new NextResponse(
        JSON.stringify({ error: " Contact number must be exactly 11 characters long" }),
        { status: 400 }
      );
    }

    if (gsisNo && gsisNo.length !== 13) {
      return new NextResponse(
        JSON.stringify({ error: " GSIS number must be exactly 10 characters long" }),
        { status: 400 }
      );
    }
    if (tinNo && tinNo.length !== 11) {
      return new NextResponse(
        JSON.stringify({ error: " TIN number must be exactly 9 characters long" }),
        { status: 400 }
      );
    }

    if (philHealthNo && philHealthNo.length !== 15) {
      return new NextResponse(
        JSON.stringify({ error: " PhilHealth number must be exactly 12 characters long" }),
        { status: 400 }
      );
    }
    if (memberPolicyNo && memberPolicyNo.length !== 13) {
      return new NextResponse(
        JSON.stringify({ error: " Member Policy number must be exactly 13 characters long" }),
        { status: 400 }
      );
    }
    if (pagIbigNo && pagIbigNo.length !== 15) {
      return new NextResponse(
        JSON.stringify({ error: " Pagibig number must be exactly 12 characters long" }),
        { status: 400 }
      );
    }

    if (employeeLink && !urlRegex.test(employeeLink)) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid URL format for employee link" }),
        { status: 400 }
      );
    }

    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }
    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 403 })
    }

    const alreadyExist = await prismadb.employee.findFirst({
      where: {
        departmentId: params.departmentId,
        lastName: lastName,
        firstName: firstName,
        // middleName: middleName,
        // contactNumber: contactNumber,
        // gsisNo,
        // tinNo,
        // pagIbigNo,
        // philHealthNo,
        // memberPolicyNo,
      },
    });

    if (alreadyExist) {
      return new NextResponse(
        JSON.stringify({ error: " Employee already exists." }),
        { status: 400 }
      );
    }

    if (contactNumber) {
      const contactNumberExists = await prismadb.employee.findFirst({
        where: {
          contactNumber: contactNumber,
        },
      });

      if (contactNumberExists) {
        return new NextResponse(
          JSON.stringify({ error: "Contact number already exists." }),
          { status: 400 }
        );
      }
    }


    if (designationId) {
      const validDesignation = await prismadb.offices.findFirst({
        where: { id: designationId, departmentId: params.departmentId },
        select: { id: true },
      });
      if (!validDesignation) {
        return new NextResponse(JSON.stringify({ error: "Invalid designationId (Office not found in this department)" }), { status: 400 });
      }
    }






    const employee = await prismadb.employee.create({
      data: {
        departmentId: params.departmentId,
        prefix,
        employeeNo,
        lastName,
        firstName,
        middleName,
        suffix,
        images: {
          createMany: {
            data: [
              ...images.map((image: { url: string }) => image)
            ]
          }
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
        // zipCode,
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
        salaryGrade: salaryGrade !== undefined ? Number(salaryGrade) : 0,
        salaryStep: salaryStep !== undefined ? Number(salaryStep) : 0,
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
        designation: { select: { id: true, name: true } }, // handy for UI
        images: true,
      },
    });


    return NextResponse.json(employee)

  } catch (error) {
    console.log('[EMPLOYEE_POST]', error);
    return new NextResponse("Internal error", { status: 500 })
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
        employeeType: { select: { id: true, name: true, value: true } }, // <-- important
      eligibility:  { select: { id: true, name: true, value: true } },
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
