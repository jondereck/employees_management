// hooks/use-employees.ts
import { EmployeesColumn } from '@/app/(dashboard)/[departmentId]/(routes)/employees/components/columns';
import useSWR from 'swr';
// adjust path if needed

const fetcher = (url: string): Promise<EmployeesColumn[]> =>
  fetch(url).then((res) => res.json());

export function useEmployees(departmentId: string, officeId?: string) {
  const shouldFetch = !!departmentId;

  const { data, error, isLoading } = useSWR<EmployeesColumn[]>(
    shouldFetch ? `/api/${departmentId}/employees${officeId ? `?officeId=${officeId}` : ''}` : null,
    fetcher,
    {
      refreshInterval: 5000,
    }
  );

  return {
    employees: data ?? [], // Make sure it's always an array
    isLoading,
    isError: error,
  };
}
