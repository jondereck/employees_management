

export interface Option {
  id: string;
  name: string;
}

export interface ImageFile {
  id: string;
  url: string;
  value?: string;
}

export interface EmployeeWithRelations {
  id: string;
  employeeNo?: string | null;
  departmentId: string;

  prefix?: string | null;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
  gender?: string | null;
  contactNumber?: string | null;

  position?: string | null;
  birthday?: string | Date | null;
  education?: string | null;

  gsisNo?: string | null;
  tinNo?: string | null;
  philHealthNo?: string | null;
  pagIbigNo?: string | null;
  memberPolicyNo?: string | null;

  salaryGrade?: string | number | null;
  salaryStep?: string | number | null;
  salary?: string | number | null;

  dateHired?: string | Date | null;
  latestAppointment?: string | null;
  terminateDate?: string | Date | null;

  isFeatured: boolean;
  isArchived: boolean;
  isHead: boolean;

  createdAt: string | Date;
  updatedAt: string | Date;

  region?: string | null;
  province?: string | null;
  city?: string | null;
  barangay?: string | null;
  houseNo?: string | null;
  age?: number | null;
  nickname?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNumber?: string | null;
  employeeLink?: string | null;

  offices: { id: string; name: string };
  employeeType: { id: string; name: string; value: string };
  eligibility: { id: string; name: string; value: string };
  images: ImageFile[];
  designation?: { id: string; name: string } | null;
  note?: string | null;
}

export interface EmployeesColumn {
  id: string;
  employeeNo?: string | null;
  department: string;

  prefix?: string | null;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
  gender?: string | null;
  contactNumber?: string | null;

  position?: string | null;
  birthday: string;
  education?: string | null;

  gsisNo?: string | null;
  tinNo?: string | null;
  philHealthNo?: string | null;
  pagIbigNo?: string | null;
  memberPolicyNo?: string | null;

  salaryGrade: string;
  salaryStep: string;
  salary?: string | number | null;

  dateHired: string;
  latestAppointment?: string | null;
  terminateDate?: string | Date | null;

  isFeatured: boolean;
  isArchived: boolean;
  isHead: boolean;
  createdAt: string;

  eligibility: { id: string; name: string; value: string };
  employeeType: { id: string; name: string; value: string };
  offices: { id: string; name: string };
  images: ImageFile[];

  region?: string | null;
  province?: string | null;
  city?: string | null;
  barangay?: string | null;
  houseNo?: string | null;
  age?: number | null;
  nickname?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNumber?: string | null;
  employeeLink?: string | null;

  updatedAt?: string | Date;
}