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
      // street,
      // barangay,
      // city,
      // province,
      // zipCode,
      gsisNo,
      tinNo,
      pagIbigNo,
      philHealthNo,
      salary,
      dateHired,
      isFeatured,
      isArchived,
      isHead,
      employeeTypeId,
      officeId,
      eligibilityId
    } = body;

    if (!firstName) {
      return new NextResponse("First Name is required", { status: 400 })
    }
    if (!lastName) {
      return new NextResponse("Last Name is required", { status: 400 })
    }
    if (!middleName) {
      return new NextResponse("Middle Name is required", { status: 400 })
    }
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
        // street,
        // barangay,
        // city,
        // province,
        // zipCode,
        gsisNo,
        tinNo,
        pagIbigNo,
        philHealthNo,
        salary,
        dateHired,
        isFeatured,
        isArchived,
        isHead,
        employeeTypeId,
        officeId,
        eligibilityId
      }
    });

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
