export type SortFieldDefinition = {
  key: string;
  label: string;
  accessor?: (row: any) => unknown;
};

export const SORT_FIELDS: readonly SortFieldDefinition[] = [
  { key: 'status', label: 'Status' },
  { key: 'appointment', label: 'Appointment' },
  { key: 'eligibility', label: 'Eligibility' },
  { key: 'updatedAt', label: 'Updated date' },
  { key: 'createdAt', label: 'Created date' },
  {
    key: 'officeBioIndexCode',
    label: 'Office: Bio Index Code',
    accessor: (row: any) => {
      const value = row?.offices?.bioIndexCode ?? row?.office?.bioIndexCode ?? '';
      return value == null ? '' : String(value);
    },
  },
] as const;
