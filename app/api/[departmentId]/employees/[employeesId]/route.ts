import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";



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
    console.group("🛑 API RECEIVED");
console.log({
  salaryMode: body.salaryMode,
  salary: body.salary,
  salaryGrade: body.salaryGrade,
  salaryStep: body.salaryStep,
});
console.groupEnd();
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
      salaryMode,
      memberPolicyNo,
      age,
      nickname,
      emergencyContactName,
      emergencyContactNumber,
      employeeLink,
      note,
      designationId,
    } = body;

    const normalizeStep = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

    const normalizeBio = (v?: string | null) => (v ?? "").replace(/[^\d]/g, "");
    const normalizedEmployeeNo = normalizeBio(employeeNo);
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

    if (normalizedEmployeeNo) {
      const duplicateEmpNo = await prismadb.employee.findFirst({
        where: {
          departmentId: params.departmentId,
          employeeNo: normalizedEmployeeNo,
           id: { not: params.employeesId }, 
        },
        select: { id: true },
      });

      if (duplicateEmpNo) {
        return new NextResponse(
          JSON.stringify({ error: "Employee number already exists." }),
          { status: 400 }
        );
      }
    }

    const existing = await prismadb.employee.findUnique({
      where: { id: params.employeesId },
      select: {
        salary: true,
        salaryMode: true,
        salaryGrade: true,
        salaryStep: true,
      },
    });

    if (!existing) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    const finalSalaryMode = salaryMode ?? existing.salaryMode;



    let finalSalary = existing.salary;

    if (finalSalaryMode === "MANUAL") {
      finalSalary = Number(salary ?? existing.salary);
    }

 if (finalSalaryMode === "AUTO") {
  const grade = Number(salaryGrade ?? existing.salaryGrade);
  const step = normalizeStep(salaryStep ?? existing.salaryStep);

  const record = await prismadb.salary.findUnique({
    where: {
      grade_step: { grade, step },
    },
    select: { amount: true },
  });

  if (!record) {
    return new NextResponse(
      `Salary table missing for SG ${grade}, Step ${step}`,
      { status: 400 }
    );
  }

  finalSalary = record.amount;
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

        // ✅ FIXED SALARY HANDLING
        salary: finalSalary,
        salaryMode: finalSalaryMode,
        salaryGrade: salaryGrade != null ? Number(salaryGrade) : existing.salaryGrade,
       salaryStep: finalSalaryMode === "AUTO"
  ? normalizeStep(salaryStep ?? existing.salaryStep)
  : salaryStep ?? existing.salaryStep,


        dateHired,
        latestAppointment,
        terminateDate,
        isFeatured,
        isArchived,
        isHead,
        employeeTypeId,
        officeId,
        eligibilityId,
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
    });


    return NextResponse.json(employee);
  } catch (error) {
    console.log("[EMPLOYEES_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}




export async function GET(
  req: Request,
  { params }: { params: { employeesId: string } }
) {
  try {


    if (!params.employeesId) {
      return new NextResponse("Employee id is required", { status: 400 });
    }


    const employee = await prismadb.employee.findUnique({
      where: {
        id: params.employeesId,

      },
      include: {
        images: true,
        offices: true,
        employeeType: true,
        eligibility: true,
        designation: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(employee);

  } catch (error) {
    console.log("[EMPLOYEES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}
