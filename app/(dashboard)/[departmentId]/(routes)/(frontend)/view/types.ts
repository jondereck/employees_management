export interface Billboard {
  id: string;
  label: string;
  imageUrl: string;
};

export interface Offices {
  id: string;
  name: string;
  billboard: Billboard;
}

export interface Image {
  id: string;
  url: string;
  value: string;
}

export interface Eligibility {
  id: string;
  name: string;
  value: string;
}
export interface EmployeeType {
  id: string;
  name: string;
  value: string;
}


export type WorkSchedulePreview = {
  id: string;
  type: "FIXED" | "FLEX" | "SHIFT";
  startTime?: string | null;
  endTime?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
 weeklyPattern: any;
};

export type AwardPreview = {
  id: string;
  title: string;
  description?: string | null;
  givenAt: string | Date; 
  issuer?: string | null;
  thumbnail?: string | null;
  fileUrl?: string | null;
  tags: string[]; // Changed from string | null to string[]
};

export type EmploymentEventPreview = {
  id: string;
  type:
    | "HIRED"
    | "PROMOTED"
    | "TRANSFERRED"
    | "REASSIGNED"
    | "AWARDED"
    | "CONTRACT_RENEWAL"
    | "TERMINATED"
    | "OTHER";
  details?: string | null;
  occurredAt: string;
};


export interface Employees {
  id: string;
  // 🔐 QR FIELDS (ADD THESE)
  publicId: string;
  publicVersion: number;
  publicEnabled: boolean;
  legacyQrAllowed: boolean;
  department: string;
  employeeNo: string;
  offices: Offices;
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  gender: string;
  contactNumber: string;
  position: string;
  birthday: string
  education: string;
  gsisNo: string;
  tinNo: string;
  philHealthNo: string;
  pagIbigNo: string;
  salary: string;
  salaryMode: string;
  salaryStep: string;
  dateHired: string;
  latestAppointment: string;
  terminateDate: string;
  isFeatured: boolean;
  isHead: boolean;
  isArchived: boolean;
  eligibility: Eligibility;
  employeeType: EmployeeType;
  images: Image[];
  workSchedules?: WorkSchedulePreview[];
  awards?: AwardPreview[];
  employmentEvents?: EmploymentEventPreview[];
  region: string;
  province: string;
  city: string;
  barangay: string;
  houseNo: string;
  salaryGrade: string;
  memberPolicyNo: string;
  age: string;
  nickname: string,
  emergencyContactName: string,
  emergencyContactNumber: string,
  employeeLink: string,
  note: string;
  designation: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;

}
