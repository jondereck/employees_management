import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server"

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
        eligibility: true
      },
    });

    return NextResponse.json(employee);

  } catch (error) {
    console.log("[EMPLOYEES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { departmentId: string, employeesId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const {
      prefix,
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
      terminateDate,
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

    if (!params.employeesId) {
      return new NextResponse("Billboard id is required", { status: 400 });
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

    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 405 })
    }

    
   

    await prismadb.employee.update({
      where: {
        id: params.employeesId,
      },
      data: {
        prefix,
        lastName,
        firstName,
        middleName,
        suffix,
        images: {
          deleteMany: {}
        },
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
        // zipCode,
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
      memberPolicyNo,
      age,
      nickname,
      emergencyContactName,
      emergencyContactNumber
      }
    });


    if (contactNumber) {
      const contactNumberExists = await prismadb.employee.findFirst({
        where: {
          id: {
            not: params.employeesId, // Exclude the current employee being updated
          },
          contactNumber: contactNumber,
        },
      });
    
      if (contactNumberExists) {
        return new NextResponse(
          JSON.stringify({ error: " Contact number already exists." }),
          { status: 400 }
        );
      }
    }
    
    
   
    
    
    const employee = await prismadb.employee.update({
      where: {
        id: params.employeesId,
      },
      data: {
        images: {
          createMany: {
            data: [
              ...images.map((image: { url: string }) => image),
            ]
          }
        }
      }
    });

    return NextResponse.json(employee);

  } catch (error) {
    console.log("[EMPLOYEES_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}


export async function DELETE(
  req: Request,
  { params }: { params: { departmentId: string, employeesId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.employeesId) {
      return new NextResponse("Employees id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 405 })
    }

    const employee = await prismadb.employee.delete({
      where: {
        id: params.employeesId,

      },
    });

    return NextResponse.json(employee);

  } catch (error) {
    console.log("[EMPLOYEES_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { departmentId: string, employeesId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.employeesId) {
      return new NextResponse("Employees id is required", { status: 400 });
    }

    const departmentByUserId = await prismadb.department.findFirst({
      where: {
        id: params.departmentId,
        userId,
      }
    });

    if (!departmentByUserId) {
      return new NextResponse("Unauthorized", { status: 405 })
    }

    const employee = await prismadb.employee.update({
      where: {
        id: params.employeesId,
      },
      data: {
        isArchived: true, // Set the archived status
        // You might also move the employee to an archived section if necessary
        // archivedDepartmentId: 'your_archived_department_id',
      },
    });

    return NextResponse.json(employee);

  } catch (error) {
    console.log("[EMPLOYEES_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}
