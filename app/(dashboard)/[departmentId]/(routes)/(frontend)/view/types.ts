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
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  gender: string;
  contactNumber: string;
  position: string;
  birthday: string
  age: string;
  gsisNo: string;
  tinNo: string; 
  philHealthNo: string;  
  pagIbigNo: string;  
  salary:  string; 
  dateHired: string;
  isFeatured: boolean;
  eligibility: Eligibility;
  employeeType: EmployeeType;
  images: Image[];
}

