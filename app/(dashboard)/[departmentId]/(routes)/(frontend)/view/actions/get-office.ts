import { Offices } from "../types";

const URL = `${process.env.NEXT_PUBLIC_API_URL}/offices`

const getOffice = async (id:string): Promise<Offices> => {
  const res = await fetch(`${URL}/${id}`);

  return res.json();
};

export default getOffice;