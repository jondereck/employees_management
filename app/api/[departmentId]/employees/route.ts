

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
      memberPolicyNo,
      age,
      nickname,
      emergencyContactName,
      emergencyContactNumber
    } = body;
    

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
        memberPolicyNo,
        age,
        nickname,
        emergencyContactName,
        emergencyContactNumber
      }
    })

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
    const { searchParams } = new URL(req.url);
    const officeId = searchParams.get("officeId") || undefined;
    const employeeTypeId = searchParams.get("employeeTypeId") || undefined;
    const eligibilityId = searchParams.get("eligibilityId") || undefined;
    const isFeatured = searchParams.get('isFeatured');
    const isHead = searchParams.get('isHead');



    if (!params.departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const employee = await prismadb.employee.findMany({
      where: {
        departmentId: params.departmentId,
        officeId,
        employeeTypeId,
        eligibilityId,
        isFeatured: isFeatured ? true : undefined,
        isArchived: false,
        isHead: isHead ? true : undefined,

      },
      include: {
        images: true,
        offices: true,
        employeeType: true,
        eligibility: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json(employee)

  } catch (error) {
    console.log('[EMPLOYEES_GET]', error);
    return new NextResponse("Internal error", { status: 500 })
  }
}