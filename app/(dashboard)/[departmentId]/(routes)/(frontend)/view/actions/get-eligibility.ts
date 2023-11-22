import { Eligibility } from "../types";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/eligibility`

const getEligibility = async (): Promise<Eligibility[]> => {
  const res = await fetch(URL);

  return res.json();
};

export default getEligibility;