import { EmployeeType } from "../types";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/employee_type`

const getEmployeeType = async (): Promise<EmployeeType[]> => {
  const res = await fetch(URL);

  return res.json();
};

export default getEmployeeType;