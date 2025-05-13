


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



export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);

  // Check if the date is valid, return 'No Data' if invalid
  if (isNaN(date.getTime())) {
    return '—';
  }

  // Format the date
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: '2-digit' };
  return date.toLocaleDateString('en-US', options);
};


export const getBirthday = (birthdayString: string): string => {

  // Parse the birthday string into a Date object
  const birthday = new Date(birthdayString);

  // Check if the parsed date is valid
  if (isNaN(birthday.getTime())) {
    console.log('Invalid date detected');
    return 'Invalid date';
  }

  // Add one day to the parsed birthday
  const nextDayBirthday = new Date(birthday);
  nextDayBirthday.setDate(birthday.getDate() + 1);

  // Format the date as 'MMMM DD, YYYY'
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: '2-digit' };
  return nextDayBirthday.toLocaleDateString('en-US', options);
};

export const getTodayBirthday = (birthdayString: string): string => {

  // Parse the birthday string into a Date object
  const birthday = new Date(birthdayString);

  // Check if the parsed date is valid
  if (isNaN(birthday.getTime())) {
    console.log('Invalid date detected');
    return 'Invalid date';
  }

  // Add one day to the parsed birthday
  const nextDayBirthday = new Date(birthday);
  nextDayBirthday.setDate(birthday.getDate() - 1);

  // Format the date as 'MMMM DD, YYYY'
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: '2-digit' };
  return nextDayBirthday.toLocaleDateString('en-US', options);
};



export const getUpcomingBirthday = (birthdayString: string): string => {

  // Parse the birthday string into a Date object
  const birthday = new Date(birthdayString);

  // Check if the parsed date is valid
  if (isNaN(birthday.getTime())) {
    console.log('Invalid date detected');
    return 'Invalid date';
  }

  // Add one day to the parsed birthday
  const nextDayBirthday = new Date(birthday);
  nextDayBirthday.setDate(birthday.getDate() + 1);

  // Format the date as 'MMMM DD, YYYY'
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: '2-digit' };
  return nextDayBirthday.toLocaleDateString('en-US', options);
};


export const formatContactNumber = (contactNumber: string) => {
  const rawNumber = contactNumber || '';
  // If rawNumber is empty, return an empty string
  if (!rawNumber.trim()) {
    return '—';
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


// Calculate the total years, months, and days of service based on hiring date and termination date (if applicable)
export const calculateYearService = (dateHired: string, terminateDate?: string): { years: number, months: number, days: number } => {
  const hireDate = new Date(dateHired);
  const currentDate = terminateDate ? new Date(terminateDate) : new Date();

  let serviceYears = currentDate.getFullYear() - hireDate.getFullYear();
  let serviceMonths = currentDate.getMonth() - hireDate.getMonth();
  let serviceDays = currentDate.getDate() - hireDate.getDate();

  // Adjust if the current date hasn't passed the hiring date in the current year
  if (currentDate.getMonth() < hireDate.getMonth() ||
    (currentDate.getMonth() === hireDate.getMonth() && currentDate.getDate() < hireDate.getDate())) {
    serviceYears -= 1;
    serviceMonths = (12 + currentDate.getMonth()) - hireDate.getMonth();
  }

  // Ensure positive month and day values
  if (serviceMonths < 0) {
    serviceMonths += 12;
  }
  if (serviceDays < 0) {
    serviceDays += new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }

  return { years: serviceYears, months: serviceMonths, days: serviceDays };
};



// Calculate the years, months, and days of service based on the latest appointment
export const calculateYearServiceLatestAppointment = (latestAppointment: string): { years: number, months: number, days: number } => {
  const appointmentDate = new Date(latestAppointment);
  const currentDate = new Date();

  let serviceYears = currentDate.getFullYear() - appointmentDate.getFullYear();
  let serviceMonths = currentDate.getMonth() - appointmentDate.getMonth();
  let serviceDays = currentDate.getDate() - appointmentDate.getDate();

  // Adjust if the current date hasn't passed the appointment date in the current year
  if (currentDate.getMonth() < appointmentDate.getMonth() ||
    (currentDate.getMonth() === appointmentDate.getMonth() && currentDate.getDate() < appointmentDate.getDate())) {
    serviceYears -= 1;
    serviceMonths = (12 + currentDate.getMonth()) - appointmentDate.getMonth();
  }

  // Ensure positive month and day values
  if (serviceMonths < 0) {
    serviceMonths += 12;
  }
  if (serviceDays < 0) {
    serviceDays += new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }

  return { years: serviceYears, months: serviceMonths, days: serviceDays };
};




// Format the latest appointment date into a readable format
export const formatLatestAppointment = (latestAppointment: string): string => {
  const appointmentDate = new Date(latestAppointment);

  if (isNaN(appointmentDate.getTime())) {
    return '—';
  }

  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: '2-digit' };
  return appointmentDate.toLocaleDateString('en-US', options);
};




// Format the termination date into a readable format, or return 'No data' if not available
export const formatTerminateDate = (terminateDate: string): string => {
  const termDate = new Date(terminateDate);

  if (isNaN(termDate.getTime())) {
    return '—';
  }

  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: '2-digit' };
  return termDate.toLocaleDateString('en-US', options);
};

// Calculate Age
export const calculateAge = (birthday: string) => {
  const birthdate = new Date(birthday);
  const currentDate = new Date();

  let ageDiff = currentDate.getFullYear() - birthdate.getFullYear();

  // Check if the birthday for this year has already occurred
  const hasBirthdayOccurred =
    currentDate.getMonth() > birthdate.getMonth() ||
    (currentDate.getMonth() === birthdate.getMonth() &&
      currentDate.getDate() >= birthdate.getDate());

  // Adjust age if the birthday hasn't occurred yet this year
  if (!hasBirthdayOccurred) {
    ageDiff -= 1;
  }

  return ageDiff;

}
// Address Format 

// In utils/addressUtils.ts
export const addressFormat = (data: {
  region?: string;
  barangay?: string;
  city?: string;
  province?: string;
  houseNo?: string;
}): string => {
  const { region, barangay, city, province, houseNo } = data;

  // Create an array of non-empty address components
  const addressComponents = [region, houseNo, barangay, city, province].filter(Boolean);
  // Convert the array elements to camel case (ensure they're strings)
  const formattedAddress = addressComponents.map((component: string | undefined) =>
    (component || '').replace(/\w\S*/g, (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  );

  // Join the formatted components with a comma and space
  return formattedAddress.join(', ');
};


/*----------------------------Columns ------------------------------*/


export const capitalizeFirstLetter = (str: string): string => {
  if (str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  return '';
};

export const formatFullName = (
  firstName: string,
  middleName: string,
  lastName: string,
  suffix: string,
  gender: string,
  prefix: string | undefined,
  position: string
): string => {
  const firstNameWords = firstName.split(' ').map(capitalizeFirstLetter).join(' ');
  const middleNameInitials = middleName.split(' ').map(word => word.charAt(0).toUpperCase()).join('');
  const lastNameWords = lastName.split(' ').map(capitalizeFirstLetter).join(' ');
  const formattedSuffix = capitalizeFirstLetter(suffix);

  const getTitle = (gender: string, prefix: string | undefined): string => {
    if (prefix) {
      return prefix.split(' ').map(capitalizeFirstLetter).join(' ');
    } else {
      return gender === 'Male' ? 'Mr.' : 'Ms.';
    }
  };

  const title = getTitle(gender, prefix);

  return `${title} ${firstNameWords} ${middleNameInitials}. ${lastNameWords}${formattedSuffix ? ` ${formattedSuffix}` : ``}, ${position}`;
};


/*----------------------------Numbers ------------------------------*/

export const formatGsisNumber = (gsisNumber: string): string => {

  if (!gsisNumber) {
    return 'N/A';
  }
  // Remove all non-numeric characters
  return gsisNumber.replace(/\D/g, '');
};


export const formatPhilHealthNumber = (philHealthNo?: string): string => {
  if (!philHealthNo) {
    return 'N/A';
  }
  
  // Remove all non-numeric characters
  const numericOnly = philHealthNo.replace(/\D/g, '');

  // Ensure the number is of expected length
  if (numericOnly.length === 12) {
    // Format to xx-xxxxxxxxx-x
    return `${numericOnly.slice(0, 2)}-${numericOnly.slice(2, 11)}-${numericOnly.slice(11, 12)}`;
  }

  return 'Invalid Number';
};


export const formatPagIbigNumber = (pagIbigNo?: string): string => {
  if (!pagIbigNo) {
    return 'N/A';
  }

  // Remove all non-numeric characters
  const numericOnly = pagIbigNo.replace(/\D/g, '');

  // Ensure the number is of expected length
  if (numericOnly.length === 12) {
    // Format to xxxx-xxxx-xxxx-xxxx
    return `${numericOnly.slice(0, 4)}-${numericOnly.slice(4, 8)}-${numericOnly.slice(8, 12)}`;
  }

  return 'Invalid Number';
};



/*---------------------------- Forms Formatting ------------------------------*/


// Utility function to convert a string to uppercase
export const formatToUpperCase = (value: string): string => {
  return value.toUpperCase();
};

export const formatToProperCase = (value: string): string => {
  // Replace "BS" with "Bachelor of Science" with "of" in lowercase
  const replacedValue = value.replace(/\bBs\b/g, 'Bachelor of Science in');

  // Capitalize the first letter of each word, except for specific words like "of"
  return replacedValue
    .split(' ')
    .map(word => {
      // Convert "of" to lowercase and capitalize other words
      if (['of', 'the', 'and', 'in'].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};



export const capitalizeWordsIgnoreSpecialChars = (input: string) => {
  return input.replace(/\b\w+\b/g, (word) => {
    // Check if the word is a Roman numeral (I, II, III, IV, V, etc.)
    if (/^(?=[MDCLXVI])M{0,3}(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/.test(word.toUpperCase())) {
      return word; // Return unchanged if it's a Roman numeral
    }

    // Capitalize the word while ignoring special characters
    const wordWithoutSpecialChars = word.replace(/[^\w\s]/g, '');
    return wordWithoutSpecialChars.charAt(0).toUpperCase() +
      wordWithoutSpecialChars.slice(1).toLowerCase();
  });
};
