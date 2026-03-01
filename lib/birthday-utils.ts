export function getBirthdayMonthDay(value: Date | string) {
  const date = new Date(value);

  return {
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function isBirthdayInMonth(value: Date | string, month: number) {
  return getBirthdayMonthDay(value).month === month;
}

export function compareBirthdayDay(
  left: Date | string,
  right: Date | string,
) {
  return getBirthdayMonthDay(left).day - getBirthdayMonthDay(right).day;
}
