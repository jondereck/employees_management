import { Employees } from "../types";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/employees`

const getEmployee = async (id:string): Promise<Employees> => {
  const res = await fetch(`${URL}/${id}`);

  return res.json();
};

export default getEmployee;