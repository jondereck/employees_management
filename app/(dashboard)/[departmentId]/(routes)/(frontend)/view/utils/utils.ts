// salaryUtils.ts
export const formatSalary = (salary: string): string => {
  const parsedSalary = parseFloat(salary);
  if (isNaN(parsedSalary)) {
    return 'Invalid Salary';
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
  }).format(parsedSalary);
};

export const calculateAnnualSalary = (salary: string): string => {
  const monthlySalary = parseFloat(salary);
  if (isNaN(monthlySalary)) {
    return 'Invalid Salary';
  }
  const annualSalary = monthlySalary * 12;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
  }).format(annualSalary);
};



export const formatContactNumber = (contactNumber: string) => {
  const rawNumber = contactNumber || '';
  // If rawNumber is empty, return an empty string
  if (!rawNumber.trim()) {
    return 'No data';
  }
  const numericOnly = rawNumber.replace(/\D/g, ''); // Remove non-numeric characters

  // Remove '+63' or '63' from the beginning
  const formattedNumber = numericOnly.replace(/^(\+63|63)/, '');

  // Add a leading '0' if it's missing
  const finalNumber = formattedNumber.startsWith('0') ? formattedNumber : `0${formattedNumber}`;

  // Format the number with spaces
  const formattedWithSpaces = `${finalNumber.slice(0, 4)}-${finalNumber.slice(4, 7)}-${finalNumber.slice(7)}`;

  return formattedWithSpaces;
};


