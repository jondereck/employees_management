import prismadb from "@/lib/prismadb";
import { resolvePlantillaAssignment } from "@/lib/plantilla-assignment";
import {
  createEmployeeHistorySnapshot,
  parseEmployeeTerminationDate,
  snapshotFieldsChanged,
  toSnapshotStatus,
} from "@/lib/workforce-history";
import {
  buildEmploymentTitle,
  createEmploymentTimelineEventOnce,
  parseTimelineDate,
} from "@/lib/employment-timeline";
import { auth } from "@clerk/nextjs";
import { MaritalStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedNullableText(value: unknown) {
  const trimmed = normalizedText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function comparableDateValue(value: Date | string | null | undefined) {
  const parsed = parseTimelineDate(value ?? null);
  return parsed ? parsed.getTime() : null;
}

function comparablePrimitive(value: unknown) {
  if (value instanceof Date) return comparableDateValue(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value === null || value === undefined) return null;
  return String(value);
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
      salaryMode,
      memberPolicyNo,
      age,
      nickname,
      emergencyContactName,
      emergencyContactNumber,
      employeeLink,
      note,
      designationId,
      officeDivisionId,
      plantillaPositionId,
      maritalStatus,
      email,
      philSysNumber,
    } = body;

    // ✅ Normalize optional government IDs (safe for nullable columns)
const normalizedGsisNo =
  typeof gsisNo === "string" && gsisNo.trim() ? gsisNo.trim() : null;

const normalizedTinNo =
  typeof tinNo === "string" && tinNo.trim() ? tinNo.trim() : null;

const normalizedPagIbigNo =
  typeof pagIbigNo === "string" && pagIbigNo.trim() ? pagIbigNo.trim() : null;

const normalizedPhilHealthNo =
  typeof philHealthNo === "string" && philHealthNo.trim() ? philHealthNo.trim() : null;

const normalizedMemberPolicyNo =
  typeof memberPolicyNo === "string" && memberPolicyNo.trim()
    ? memberPolicyNo.trim()
    : null;

    const normalizeStep = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

    const normalizeBio = (v?: string | null) => (v ?? "").replace(/[^\d]/g, "");
    const normalizedEmployeeNo = normalizeBio(employeeNo);
    const normalizedMiddleName = typeof middleName === "string" ? middleName.trim() : "";
    const normalizedEmail = typeof email === "string" && email.trim() ? email.trim() : null;
    const normalizedPhilSysNumber = typeof philSysNumber === "string" && philSysNumber.trim() ? philSysNumber.trim() : null;
    const normalizedMaritalStatus =
      typeof maritalStatus === "string" && Object.values(MaritalStatus).includes(maritalStatus as MaritalStatus)
        ? (maritalStatus as MaritalStatus)
        : null;
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

    if (normalizedEmail) {
      const emailExists = await prismadb.employee.findFirst({
        where: {
          id: { not: params.employeesId },
          email: normalizedEmail,
        },
        select: { id: true },
      });
      if (emailExists) {
        return new NextResponse(JSON.stringify({ error: "Email already exists." }), { status: 400 });
      }
    }

    if (normalizedPhilSysNumber) {
      const philSysNumberExists = await prismadb.employee.findFirst({
        where: {
          id: { not: params.employeesId },
          philSysNumber: normalizedPhilSysNumber,
        },
        select: { id: true },
      });
      if (philSysNumberExists) {
        return new NextResponse(JSON.stringify({ error: "PhilSys Number already exists." }), { status: 400 });
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
        id: true,
        departmentId: true,
        prefix: true,
        employeeNo: true,
        lastName: true,
        firstName: true,
        middleName: true,
        suffix: true,
        officeId: true,
        employeeTypeId: true,
        eligibilityId: true,
        position: true,
        birthday: true,
        education: true,
        houseNo: true,
        street: true,
        barangay: true,
        city: true,
        province: true,
        gsisNo: true,
        tinNo: true,
        pagIbigNo: true,
        philHealthNo: true,
        gender: true,
        contactNumber: true,
        isHead: true,
        isFeatured: true,
        isArchived: true,
        dateHired: true,
        latestAppointment: true,
        terminateDate: true,
        salary: true,
        salaryMode: true,
        salaryGrade: true,
        salaryStep: true,
        memberPolicyNo: true,
        age: true,
        nickname: true,
        emergencyContactName: true,
        emergencyContactNumber: true,
        employeeLink: true,
        note: true,
        designationId: true,
        officeDivisionId: true,
        plantillaPositionId: true,
        maritalStatus: true,
        email: true,
        philSysNumber: true,
        offices: { select: { name: true } },
      },
    });

    if (!existing) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    const assignment = await prismadb.$transaction(async (tx) =>
      resolvePlantillaAssignment(tx, {
        departmentId: params.departmentId,
        officeId,
        officeDivisionId:
          officeDivisionId === undefined ? existing.officeDivisionId : officeDivisionId,
        plantillaPositionId:
          plantillaPositionId === undefined
            ? existing.plantillaPositionId
            : plantillaPositionId,
        employeeId: params.employeesId,
      })
    );
    if (!assignment.ok) {
      return NextResponse.json({ error: assignment.error }, { status: 400 });
    }

    const positionFinal =
      assignment.plantillaTitle?.trim() ||
      (typeof position === "string" ? position : existing.position);

    const hadTerminationDate = hasText(existing.terminateDate);
    const wasInactive = existing.isArchived || hadTerminationDate;
    const willBeArchived = Boolean(isArchived);
    const willBeActive = !willBeArchived;
    const isRehire = wasInactive && willBeActive;
    const nextLatestAppointmentDate = parseTimelineDate(latestAppointment);
    const previousTerminationDate = parseTimelineDate(existing.terminateDate);

    if (isRehire && !nextLatestAppointmentDate) {
      return new NextResponse(
        JSON.stringify({
          error: "Latest appointment date is required when rehiring or restoring a terminated employee.",
        }),
        { status: 400 }
      );
    }

    if (
      isRehire &&
      previousTerminationDate &&
      nextLatestAppointmentDate &&
      nextLatestAppointmentDate.getTime() <= previousTerminationDate.getTime()
    ) {
      return new NextResponse(
        JSON.stringify({
          error: "Latest appointment date must be after the previous termination date.",
        }),
        { status: 400 }
      );
    }

    const finalSalaryMode = salaryMode ?? existing.salaryMode;



    let finalSalary = existing.salary;

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

    if (finalSalaryMode === "MANUAL") {
      finalSalary = Number(salary ?? existing.salary);
    }

    if (finalSalaryMode === "AUTO") {
      finalSalary = record.amount;
    }

    const normalizedTerminateDate = willBeActive ? "" : (terminateDate ?? "");
    const normalizedSalaryGrade =
      salaryGrade != null ? Number(salaryGrade) : existing.salaryGrade;
    const normalizedSalaryStep =
      finalSalaryMode === "AUTO"
        ? normalizeStep(salaryStep ?? existing.salaryStep)
        : salaryStep ?? existing.salaryStep;

    const proposedState = {
      prefix: normalizedText(prefix),
      employeeNo: normalizedText(employeeNo),
      lastName: normalizedText(lastName),
      firstName: normalizedText(firstName),
      middleName: normalizedMiddleName,
      suffix: normalizedText(suffix),
      gender,
      contactNumber: normalizedText(contactNumber),
      position: normalizedText(positionFinal),
      birthday: comparableDateValue(birthday) ?? comparableDateValue(existing.birthday),
      education: normalizedText(education),
      houseNo: normalizedText(houseNo),
      street: normalizedText(street),
      barangay: normalizedText(barangay),
      city: normalizedText(city),
      province: normalizedText(province),
      gsisNo: normalizedNullableText(normalizedGsisNo),
      tinNo: normalizedNullableText(normalizedTinNo),
      pagIbigNo: normalizedNullableText(normalizedPagIbigNo),
      philHealthNo: normalizedNullableText(normalizedPhilHealthNo),
      salary: finalSalary,
      salaryMode: finalSalaryMode,
      salaryGrade: normalizedSalaryGrade,
      salaryStep: normalizedSalaryStep,
      dateHired: comparableDateValue(dateHired) ?? comparableDateValue(existing.dateHired),
      latestAppointment: normalizedText(latestAppointment),
      terminateDate: normalizedText(normalizedTerminateDate),
      isFeatured: Boolean(isFeatured),
      isArchived: willBeArchived,
      isHead: Boolean(isHead),
      employeeTypeId: normalizedText(employeeTypeId),
      officeId: normalizedText(officeId),
      eligibilityId: normalizedText(eligibilityId),
      memberPolicyNo: normalizedNullableText(normalizedMemberPolicyNo),
      age: normalizedText(age),
      nickname: normalizedText(nickname),
      emergencyContactName: normalizedText(emergencyContactName),
      emergencyContactNumber: normalizedText(emergencyContactNumber),
      employeeLink: normalizedText(employeeLink),
      note: normalizedNullableText(note),
      designationId: normalizedNullableText(designationId),
      officeDivisionId: assignment.officeDivisionId,
      plantillaPositionId: assignment.plantillaPositionId,
      maritalStatus: maritalStatus === undefined ? existing.maritalStatus : normalizedMaritalStatus,
      email: email === undefined ? existing.email : normalizedEmail,
      philSysNumber: philSysNumber === undefined ? existing.philSysNumber : normalizedPhilSysNumber,
    };

    const existingState = {
      prefix: normalizedText(existing.prefix),
      employeeNo: normalizedText(existing.employeeNo),
      lastName: normalizedText(existing.lastName),
      firstName: normalizedText(existing.firstName),
      middleName: normalizedText(existing.middleName),
      suffix: normalizedText(existing.suffix),
      gender: existing.gender,
      contactNumber: normalizedText(existing.contactNumber),
      position: normalizedText(existing.position),
      birthday: comparableDateValue(existing.birthday),
      education: normalizedText(existing.education),
      houseNo: normalizedText(existing.houseNo),
      street: normalizedText(existing.street),
      barangay: normalizedText(existing.barangay),
      city: normalizedText(existing.city),
      province: normalizedText(existing.province),
      gsisNo: normalizedNullableText(existing.gsisNo),
      tinNo: normalizedNullableText(existing.tinNo),
      pagIbigNo: normalizedNullableText(existing.pagIbigNo),
      philHealthNo: normalizedNullableText(existing.philHealthNo),
      salary: existing.salary,
      salaryMode: existing.salaryMode,
      salaryGrade: existing.salaryGrade,
      salaryStep: existing.salaryStep,
      dateHired: comparableDateValue(existing.dateHired),
      latestAppointment: normalizedText(existing.latestAppointment),
      terminateDate: normalizedText(existing.terminateDate),
      isFeatured: Boolean(existing.isFeatured),
      isArchived: Boolean(existing.isArchived),
      isHead: Boolean(existing.isHead),
      employeeTypeId: normalizedText(existing.employeeTypeId),
      officeId: normalizedText(existing.officeId),
      eligibilityId: normalizedText(existing.eligibilityId),
      memberPolicyNo: normalizedNullableText(existing.memberPolicyNo),
      age: normalizedText(existing.age),
      nickname: normalizedText(existing.nickname),
      emergencyContactName: normalizedText(existing.emergencyContactName),
      emergencyContactNumber: normalizedText(existing.emergencyContactNumber),
      employeeLink: normalizedText(existing.employeeLink),
      note: normalizedNullableText(existing.note),
      designationId: normalizedNullableText(existing.designationId),
      officeDivisionId: existing.officeDivisionId ?? null,
      plantillaPositionId: existing.plantillaPositionId ?? null,
      maritalStatus: existing.maritalStatus,
      email: existing.email,
      philSysNumber: existing.philSysNumber,
    };

    const changedFields = new Set<string>();
    for (const key of Object.keys(existingState) as Array<keyof typeof existingState>) {
      if (comparablePrimitive(existingState[key]) !== comparablePrimitive(proposedState[key])) {
        changedFields.add(key);
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
        middleName: normalizedMiddleName,
        suffix,
        gender,
        contactNumber,
        position: positionFinal,
        birthday,
        education,
        houseNo,
        street,
        barangay,
        city,
        province,
       gsisNo: normalizedGsisNo,
tinNo: normalizedTinNo,
pagIbigNo: normalizedPagIbigNo,
philHealthNo: normalizedPhilHealthNo,
memberPolicyNo: normalizedMemberPolicyNo,
       

        // ✅ FIXED SALARY HANDLING
        salary: finalSalary,
        salaryMode: finalSalaryMode,
        salaryGrade: normalizedSalaryGrade,
        salaryStep: normalizedSalaryStep,


        dateHired,
        latestAppointment,
        terminateDate: normalizedTerminateDate,
        isFeatured,
        isArchived: willBeArchived,
        isHead,
        employeeTypeId,
        officeId,
        eligibilityId,

        age,
        nickname,
        emergencyContactName,
        emergencyContactNumber,
        employeeLink,
        maritalStatus: maritalStatus === undefined ? existing.maritalStatus : normalizedMaritalStatus,
        email: email === undefined ? existing.email : normalizedEmail,
        philSysNumber: philSysNumber === undefined ? existing.philSysNumber : normalizedPhilSysNumber,

        images: {
          deleteMany: {},
          createMany: { data: images.map((img: { url: string }) => img) },
        },

        note: note ?? null,
        designationId: normalizedNullableText(designationId),
        officeDivisionId: assignment.officeDivisionId,
        plantillaPositionId: assignment.plantillaPositionId,
      },
      include: {
        offices: { select: { name: true } },
        employeeType: { select: { name: true } },
      },
    });

    const beforeLatestAppointment = existing.latestAppointment ? new Date(existing.latestAppointment).getTime() : 0;
    const afterLatestAppointment = employee.latestAppointment ? new Date(employee.latestAppointment).getTime() : 0;
    const hasLatestAppointmentChange =
      beforeLatestAppointment !== afterLatestAppointment && Boolean(employee.latestAppointment);
    const previousSalaryGrade = Number(existing.salaryGrade ?? 0);
    const nextSalaryGrade = Number(employee.salaryGrade ?? 0);
    const isSalaryGradePromotion =
      Number.isFinite(previousSalaryGrade) &&
      Number.isFinite(nextSalaryGrade) &&
      nextSalaryGrade > previousSalaryGrade;
    const hasTransferSignal =
      changedFields.has("officeId") ||
      changedFields.has("position") ||
      changedFields.has("plantillaPositionId") ||
      changedFields.has("officeDivisionId");

    if (isRehire) {
      await createEmploymentTimelineEventOnce(prismadb, {
        employeeId: employee.id,
        type: "HIRED",
        occurredAt: parseTimelineDate(employee.latestAppointment) ?? new Date(),
        title: `Rehired. ${buildEmploymentTitle("Hired", {
          position: employee.position,
          employeeTypeName: employee.employeeType?.name,
          officeName: employee.offices?.name,
        })}`,
      });
    } else if (isSalaryGradePromotion) {
      await createEmploymentTimelineEventOnce(prismadb, {
        employeeId: employee.id,
        type: "PROMOTED",
        occurredAt: parseTimelineDate(employee.latestAppointment) ?? new Date(),
        title: buildEmploymentTitle("Promoted", {
          position: employee.position,
          employeeTypeName: employee.employeeType?.name,
          officeName: employee.offices?.name,
        }),
        description: `Promoted from SG ${previousSalaryGrade || 0} to SG ${nextSalaryGrade || 0}.`,
      });
    } else if (hasLatestAppointmentChange && !isSalaryGradePromotion && hasTransferSignal) {
      const fromOfficeName = existing.offices?.name?.trim() || "previous office";
      const toOfficeName = employee.offices?.name?.trim() || "new office";
      const fromPosition = existing.position?.trim() || "previous position";
      const toPosition = employee.position?.trim() || "new position";
      const positionChanged = fromPosition.toLowerCase() !== toPosition.toLowerCase();
      await createEmploymentTimelineEventOnce(prismadb, {
        employeeId: employee.id,
        type: "TRANSFERRED",
        occurredAt: parseTimelineDate(employee.latestAppointment) ?? new Date(),
        title: positionChanged
          ? `Transferred from ${fromOfficeName} to ${toOfficeName} as ${toPosition}.`
          : `Transferred from ${fromOfficeName} to ${toOfficeName}.`,
        description: `Transferred from ${fromPosition} (${fromOfficeName}) to ${toPosition} (${toOfficeName})${employee.employeeType?.name ? ` as ${employee.employeeType.name}` : ""}.`,
      });
    }

    const becameArchived = !wasInactive && employee.isArchived;
    const gotTerminationDate = !hadTerminationDate && hasText(employee.terminateDate);
    if (becameArchived || gotTerminationDate) {
      await createEmploymentTimelineEventOnce(prismadb, {
        employeeId: employee.id,
        type: "TERMINATED",
        occurredAt: parseTimelineDate(employee.terminateDate) ?? new Date(),
        title: "Terminated",
      });
    }

    if (isRehire) {
      await createEmployeeHistorySnapshot(prismadb, employee, {
        effectiveAt: parseTimelineDate(employee.latestAppointment) ?? new Date(),
        status: toSnapshotStatus(employee.isArchived),
        source: "REHIRE",
        note: "Active snapshot created when employee returned after termination/archive.",
      });
    } else if (snapshotFieldsChanged(existing, employee)) {
      await createEmployeeHistorySnapshot(prismadb, employee, {
        effectiveAt:
          toSnapshotStatus(employee.isArchived) === "INACTIVE"
            ? parseEmployeeTerminationDate(employee.terminateDate) ?? new Date()
            : new Date(),
        status: toSnapshotStatus(employee.isArchived),
        source: "PROFILE_UPDATE",
        note: "Snapshot created after employee profile fields affecting workforce reports changed.",
      });
    }

    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.includes("email")) {
        return new NextResponse(JSON.stringify({ error: "Email already exists." }), { status: 400 });
      }
      if (target.includes("philSysNumber")) {
        return new NextResponse(JSON.stringify({ error: "PhilSys Number already exists." }), { status: 400 });
      }
      if (target.includes("plantillaPositionId")) {
        return NextResponse.json(
          { error: "Plantilla position is already occupied by another employee" },
          { status: 400 }
        );
      }
    }
    console.log("[EMPLOYEES_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}




export async function GET(
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

    if (!params.departmentId) {
      return new NextResponse("Department id is required", { status: 400 });
    }

    const department = await prismadb.department.findFirst({
      where: { id: params.departmentId, userId },
      select: { id: true },
    });

    if (!department) {
      return new NextResponse("Unauthorized", { status: 403 });
    }


    const employee = await prismadb.employee.findFirst({
      where: { id: params.employeesId, departmentId: params.departmentId },
      include: {
        images: true,
        offices: true,
        employeeType: true,
        eligibility: true,
        designation: true,
        officeDivision: { select: { id: true, name: true } },
        plantillaPosition: {
          select: { id: true, itemNumber: true, title: true, officeDivisionId: true },
        },
        workSchedules: true,
        awards: true,
        employmentEvents: true,
      },
    });

    if (!employee) {
      return new NextResponse("Employee not found", { status: 404 });
    }



    return NextResponse.json(employee);

    

  } catch (error) {
    console.log("[EMPLOYEES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 })
  }
}
