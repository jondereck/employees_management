import { Employees } from "../types";
import qs from "query-string";

type WithDesignationNote = {
  designation?: { id: string; name: string } | null;
  note?: string | null;
};

const URL = `${process.env.NEXT_PUBLIC_API_URL}/employees`

interface Query {
  officeId?: string;
  employeeTypeId?: string;
  eligibilityId?: string;
  isFeatured?: boolean;
  isArchived?: boolean;
}

const getEmployees = async (query: Query): Promise<(Employees & WithDesignationNote)[]> => {
  const url = qs.stringifyUrl({
    url: URL,
    query: {
      officeId: query.officeId,
      employeeTypeId: query.employeeTypeId,
      eligibilityId: query.eligibilityId,
      isFeatured: query.isFeatured,
      isArchived: query.isArchived
      
    },
  });
  const res = await fetch(url);

  return res.json();
};

export default getEmployees;