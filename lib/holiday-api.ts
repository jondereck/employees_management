type Holiday = {
  name: string
  date: string
  public: boolean
}

export async function fetchPhilippineHolidays(year: number): Promise<Holiday[]> {
  const key = process.env.HOLIDAY_API_KEY

  if (!key) {
    throw new Error("HOLIDAY_API_KEY is missing")
  }

  const url = new URL("https://holidayapi.com/v1/holidays")

  url.searchParams.set("country", "PH")
  url.searchParams.set("year", year.toString())
  url.searchParams.set("public", "true")
  url.searchParams.set("key", key)

  const res = await fetch(url.toString(), {
    next: { revalidate: 86400 } // cache for 1 day
  })

  if (!res.ok) {
    throw new Error("Failed to fetch holidays")
  }

  const data = await res.json()

  return data.holidays ?? []
}