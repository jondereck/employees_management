import { Offices } from "../types";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/offices`

const getOffices = async (): Promise<Offices[]> => {
  const res = await fetch(URL);

  return res.json();
};

export default getOffices;