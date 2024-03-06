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
  value: EmployeeType;
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

export interface Employees {
  id: string;
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
  gsisNo: string;
  tinNo: string;
  philHealthNo: string;
  pagIbigNo: string;
  salary: string;
  dateHired: string;
  latestAppointment: string;
  terminateDate: string;
  isFeatured: boolean;
  isHead: boolean;
  eligibility: Eligibility;
  employeeType: EmployeeType;
  images: Image[];
  region: string;
  province: string;
  city: string;
  barangay: string;
  houseNo: string;
  salaryGrade: string;
  memberPolicyNo: string;
  age: string;

}

