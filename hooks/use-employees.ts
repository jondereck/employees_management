// hooks/use-employees.ts
import useSWR from "swr";
import axios from "axios";
import { EmployeeWithRelations } from "@/lib/types";


export const employeesKey = (departmentId: string) =>
  `/api/${departmentId}/employees`;

export function useEmployees(departmentId: string) {
  const { data, error, isLoading, mutate } = useSWR<EmployeeWithRelations[]>(
    employeesKey(departmentId),
    (url: string) =>
      axios.get(url).then((r) => r.data as EmployeeWithRelations[]),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    employees: data ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
