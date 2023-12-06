import prismadb from "@/lib/prismadb";
import {EmployeesForm } from "./components/employees-form";
import { useState } from "react";

const EmployeesIdPage = async ({
  params
}: {
  params: { employeesId: string, officeId: string, eligibilityId: string, employeeTypeId: string }
}) => {

  const employees = await prismadb.employee.findUnique ({
    where: {
      id: params.employeesId
    },
    include: {
      images: true
    }
  });
  const offices =  await prismadb.offices.findMany ({
    where: {
      id: params.officeId
    }
  })
  const employeeType =  await prismadb.employeeType.findMany ({
    where: {
      id: params.employeeTypeId
    }
  })

  const eligibility =  await prismadb.eligibility.findMany ({
    where: {
      id: params.eligibilityId
    }
  })

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
      <EmployeesForm employeeType={employeeType} eligibility={eligibility} offices={offices} initialData={employees}/>
      </div>
    </div>
  );
}

export default EmployeesIdPage;