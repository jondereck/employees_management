import { fetchPhilippineHolidays } from "./holiday-api"

export async function isHoliday(date: Date) {
  const year = date.getFullYear()
  const holidays = await fetchPhilippineHolidays(year)

  const dateStr = date.toISOString().split("T")[0]

  return holidays.find(h => h.date === dateStr) ?? null
}