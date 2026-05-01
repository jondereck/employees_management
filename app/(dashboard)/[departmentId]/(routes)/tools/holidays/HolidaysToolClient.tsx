"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type HolidayItem = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  types: string[];
};

type ApiResponse =
  | { holidays: HolidayItem[]; source: "nager.date" }
  | { error: string; [key: string]: unknown };

async function fetchHolidays(country: string, year: string) {
  const url = new URL("/api/tools/holidays", window.location.origin);
  url.searchParams.set("country", country);
  url.searchParams.set("year", year);
  const response = await fetch(url.toString());
  const payload = (await response.json().catch(() => ({}))) as ApiResponse;
  if (!response.ok) {
    const message = typeof (payload as any)?.error === "string" ? (payload as any).error : "Request failed";
    throw new Error(message);
  }
  if (!("holidays" in payload) || !Array.isArray((payload as any).holidays)) {
    throw new Error("Unexpected response");
  }
  return (payload as any).holidays as HolidayItem[];
}

export default function HolidaysToolClient() {
  const [country, setCountry] = React.useState("PH");
  const [year, setYear] = React.useState("2026");
  const [holidays, setHolidays] = React.useState<HolidayItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchHolidays(country.trim().toUpperCase(), year.trim());
      setHolidays(items);
    } catch (err: any) {
      setHolidays([]);
      setError(err?.message ?? "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }, [country, year]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-[2rem] border border-white/40 bg-white/40 p-6 backdrop-blur-xl shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="grid w-full grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500" htmlFor="holiday-country">
              Country
            </label>
            <Input
              id="holiday-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="PH"
              className="h-11 rounded-2xl bg-white/60"
              inputMode="text"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500" htmlFor="holiday-year">
              Year
            </label>
            <Input
              id="holiday-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
              className="h-11 rounded-2xl bg-white/60"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={load}
            className="h-11 rounded-2xl font-black"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCountry("PH");
              setYear("2026");
            }}
            className="h-11 rounded-2xl bg-white/60"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className={cn("rounded-[2rem] border border-white/40 bg-white/40 backdrop-blur-xl shadow-sm", loading && "opacity-80")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Local Name</TableHead>
              <TableHead className="hidden lg:table-cell">Types</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length ? (
              holidays.map((holiday) => (
                <TableRow key={`${holiday.countryCode}-${holiday.date}-${holiday.name}`}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{holiday.date}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{holiday.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-slate-600">{holiday.localName}</TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-600">
                    {holiday.types?.length ? holiday.types.join(", ") : "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-16 text-center text-sm text-slate-500">
                  {loading ? "Loading holidays…" : "No holidays found for that query."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

