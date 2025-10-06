type Employee = {
  firstName: string;
  lastName: string;
  dateHired: string;
  isArchived: boolean;
}

// Check if a date (MM-DD) matches today's date
export const isTodayBirthday = (birthday: string) => {
  const today = new Date();
  const birthDate = new Date(birthday);
  return (
    birthDate.getDate() === today.getDate() &&
    birthDate.getMonth() === today.getMonth()
  );
};

// Get formatted date (e.g., Jan 20)
export const getFormattedDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Add 1 day to fix off-by-one timezone issues (optional)
export const addOneDay = (date: Date) => {
  const d = new Date(date);
  d.setDate(d.getDate() + 0);
  return d;
};

// Sort birthdays by month + day (ignoring year)
export const sortByMonthDay = (list: any[]) =>
  [...list].sort((a, b) => {
    const aDate = new Date(a.birthday);
    const bDate = new Date(b.birthday);
    const aVal = aDate.getMonth() * 100 + aDate.getDate();
    const bVal = bDate.getMonth() * 100 + bDate.getDate();
    return aVal - bVal;
  });

  
// Check if birthday (when they turn 65) already passed this year
export const isRetirementNextYear = (birthday: string) => {
  const today = new Date();
  const birthDate = new Date(birthday);
  const retirementDate = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  return retirementDate < today; // already passed this year
};

// Sort retirees by upcoming birthday (when they turn 65)
export const getSortedRetirees = (employees: any[]) => {
  const today = new Date();

  return [...employees].sort((a, b) => {
    const aDate = new Date(today.getFullYear(), new Date(a.birthday).getMonth(), new Date(a.birthday).getDate());
    const bDate = new Date(today.getFullYear(), new Date(b.birthday).getMonth(), new Date(b.birthday).getDate());
    return aDate.getTime() - bDate.getTime();
  });
};


export const getSortedMilestones = (anniversaries: Employee[]) => {
  const today = new Date();

  const nextAnniv = (dateStr: string) => {
    const hired = new Date(dateStr);
    const annivThisYear = new Date(today.getFullYear(), hired.getMonth(), hired.getDate());
    if (annivThisYear < today) {
      annivThisYear.setFullYear(today.getFullYear() + 1);
    }
    return annivThisYear;
  };

  return [...anniversaries].sort((a, b) => {
    const aNext = nextAnniv(a.dateHired).getTime();
    const bNext = nextAnniv(b.dateHired).getTime();
    return aNext - bNext;
  });
};

export const isNextYearAnniversary = (dateStr: string) => {
  const today = new Date();
  const hired = new Date(dateStr);
  const annivThisYear = new Date(today.getFullYear(), hired.getMonth(), hired.getDate());
  return annivThisYear < today; // already passed → anniversary will be next year
};

