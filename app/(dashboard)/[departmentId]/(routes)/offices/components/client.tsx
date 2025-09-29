// app/(dashboard)/[departmentId]/(routes)/offices/components/offices-client.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import ApiList from "@/components/ui/api-list";
import ApiHeading from "@/components/ui/api-heading";
import SearchFilter from "@/components/search-filter";
import { useDebounce } from "@/hooks/use-debounce";
import { OfficesColumn, columns } from "./columns";

interface OfficesClientProps {
  data: OfficesColumn[];
}

export const OfficesClient = ({ data }: OfficesClientProps) => {
  const router = useRouter();
  const { departmentId } = useParams() as { departmentId?: string };

  // key parts only
const STORAGE_KEY = `offices_search_v1:${departmentId ?? "global"}`;

const [mounted, setMounted] = useState(false);
const [searchTerm, setSearchTerm] = useState(""); // 🔒 stable SSR value

useEffect(() => {
  // now we're on the client, it's safe to touch localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (typeof saved === "string") setSearchTerm(saved);
  } catch {}
  setMounted(true);
}, [STORAGE_KEY]);

const debounced = useDebounce(searchTerm, 400);
const isDebouncing = debounced !== searchTerm;

// 👇 keep server and first client paint identical: don't filter until mounted
const filtered = useMemo(() => {
  if (!mounted) return data;
  const q = (debounced || "").trim().toLowerCase();
  if (!q) return data;
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

  const m = q.match(/^\?([a-z]+)\s*(.*)$/i);
  const mode = m?.[1]?.toLowerCase() ?? null;
  const term = norm(m?.[2] ?? q);

  return data.filter((row) => {
    const name = norm(row.name);
    const billboard = norm(row.billboardLabel);
    const bio = norm(row.bioIndexCode as any);
    if (!mode) return name.includes(term) || billboard.includes(term) || bio.includes(term);
    if (mode === "off") return name.includes(term);
    return name.includes(term) || billboard.includes(term) || bio.includes(term);
  });
}, [mounted, data, debounced]);

// Title count: avoid mismatch by using the same number until mounted
const shownCount = mounted ? filtered.length : data.length;


  return (
    <>
      <div className="flex items-center justify-between">
        <Heading
          title={`Offices (${filtered.length})`}
          description="Manage offices on your workplace."
        />
        <Button onClick={() => router.push(`/${departmentId}/offices/new`)}>
          <Plus className="mr-2 h-4 w-4" /> New
        </Button>
      </div>

      <div className="mt-4 mb-2">
        <SearchFilter
          searchTerm={searchTerm}
          setSearchTerm={(v) => {
            setSearchTerm(v);
            try { localStorage.setItem(STORAGE_KEY, v); } catch { }
          }}
          isDebouncing={mounted ? isDebouncing : false}
        />
      </div>

      <Separator />

      <DataTable
        searchKeys={["name", "billboardLabel", "bioIndexCode"]} // optional if your table uses it
        columns={columns}
        data={filtered}
      />

      <ApiHeading title="API" description="API calls for Offices" />
      <ApiList entityIdName="officeId" entityName="offices" />
    </>
  );
};
