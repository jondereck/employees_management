import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { departmentId: string; employeeId: string } }
) {
  try {
    const employee = await prismadb.employee.findFirst({
      where: { id: params.employeeId, departmentId: params.departmentId },
      include: {
        images: true,
        offices: true,            // if your relation is singular, rename to 'office: true'
        employeeType: true,
        eligibility: true,
        designation: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(employee ?? null, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to fetch employee", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
 
export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string; employeesId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.employeesId) {
      return new NextResponse("Employee id is required", { status: 400 });
    }

    const body = await req.json();
    const {
      prefix,
      employeeNo,
      lastName,
      firstName,
      middleName,
      suffix,
      images = [],
      gender,
      contactNumber,
      position,
      birthday,
      education,
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
      terminateDate,
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

    // Validation
    if (!firstName) return new NextResponse("First Name is required", { status: 400 });
    if (!lastName) return new NextResponse("Last Name is required", { status: 400 });
    if (!position) return new NextResponse("Position is required", { status: 400 });
    if (!officeId) return new NextResponse("Office is required", { status: 400 });
    if (!employeeTypeId) return new NextResponse("Appointment is required", { status: 400 });

    if (contactNumber && contactNumber.length !== 11)
      return new NextResponse(JSON.stringify({ error: "Contact number must be 11 digits" }), { status: 400 });

    if (emergencyContactNumber && emergencyContactNumber.length !== 11)
      return new NextResponse(JSON.stringify({ error: "Emergency contact must be 11 digits" }), { status: 400 });

    const urlRegex = /^https:\/\/drive\.google\.com\/.*$/;
    if (employeeLink && !urlRegex.test(employeeLink))
      return new NextResponse(JSON.stringify({ error: "Invalid URL format for employee link" }), { status: 400 });

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
    });
    if (!department) return new NextResponse("Unauthorized", { status: 403 });

    // Check contact number uniqueness
    if (contactNumber) {
      const exists = await prismadb.employee.findFirst({
        where: {
          id: { not: params.employeesId },
          contactNumber,
        },
      });
      if (exists) return new NextResponse(JSON.stringify({ error: "Contact number already exists" }), { status: 400 });
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

    // Update employee with merged images
    const employee = await prismadb.employee.update({
      where: { id: params.employeesId },
      data: {
        prefix,
        employeeNo,
        lastName,
        firstName,
        middleName,
        suffix,
        gender,
        contactNumber,
        position,
        birthday,
        education,
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
        terminateDate,
        isFeatured,
        isArchived,
        isHead,
        employeeTypeId,
        officeId,
        eligibilityId,
        salaryGrade: salaryGrade ? Number(salaryGrade) : null,
        memberPolicyNo,
        age,
        nickname,
        emergencyContactName,
        emergencyContactNumber,
        employeeLink,
        images: {
          deleteMany: {},
          createMany: { data: images.map((img: { url: string }) => img) },
        },
         note: note ?? null,
        designationId: designationId ?? null,
      },
      include: {
        designation: { select: { id: true, name: true } },
        images: true,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.log("[EMPLOYEES_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
