import { Employees } from "../types";
import qs from "query-string";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/employees`

interface Query {
  officeId?: string;
  employeeTypeId?: string;
  eligibilityId?: string;
  isFeatured?: boolean;
}

const getEmployees = async (query: Query): Promise<Employees[]> => {
  const url = qs.stringifyUrl({
    url: URL,
    query: {
      officeId: query.officeId,
      employeeTypeId: query.employeeTypeId,
      eligibilityId: query.eligibilityId,
      isFeatured: query.isFeatured,
    },
  });
  const res = await fetch(url);

  return res.json();
};

export default getEmployees;