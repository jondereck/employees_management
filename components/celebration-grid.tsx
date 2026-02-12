"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  Calendar,
  Search,
  Users,
} from "lucide-react";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

export type CelebrationPerson = {
  id: string;
  fullName: string;
  primaryLabel: string;
  secondaryLabel?: string;
  badge?: string;
  highlight?: string | null;
  status?: "upcoming" | "completed";
  eventDate?: string;
  imageUrl?: string | null;
  employeeTypeId?: string | null; // ✅ required for filtering
};

type CelebrationGridProps = {
  title: string;
  subtitle?: string;
  description?: string;
  people: CelebrationPerson[];
  emptyMessage: string;
  onPersonClick?: (person: CelebrationPerson) => void;
  enableDownload?: boolean;
  employeeTypes?: { id: string; name: string }[];
    onDownload?: () => void;
};

export function CelebrationGrid({
  title,
  subtitle,
  description,
  people,
  emptyMessage,
  onPersonClick,
  enableDownload = false,
  employeeTypes = [],
  onDownload,
}: CelebrationGridProps) {

  const clickable = typeof onPersonClick === "function";

  return (
    <div className="min-h-screen w-full bg-cover bg-fixed bg-center antialiased">
      <div className="min-h-screen w-full bg-slate-50/80 backdrop-blur-[2px] p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ================= HEADER ================= */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="bg-white/40 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-sm">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {title}
              </h1>
              {subtitle && (
                <p className="text-slate-600 mt-1 font-medium">{subtitle}</p>
              )}
            </div>

     
          </div>

          {/* ================= TOOLBAR ================= */}
    

          {/* ================= CONTENT ================= */}
          <div className="pt-4">
            {people.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white/30 backdrop-blur-md rounded-3xl border-2 border-dashed border-white/50">
                <Users className="w-12 h-12 text-slate-400 mb-4 opacity-50" />
                <h3 className="text-slate-800 font-bold uppercase tracking-widest">
                  {emptyMessage}
                </h3>
              </div>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {people.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => clickable && onPersonClick?.(person)}
                    className="group relative flex flex-col overflow-hidden rounded-3xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl text-left"
                  >
                    <div
                      className="relative aspect-[4/5] w-full overflow-hidden bg-cover bg-center"
                      style={{ backgroundImage: "url('/bday_bg.png')" }}
                    >
                      <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />

                      <Image
                        src={person.imageUrl || "/avatar-placeholder.png"}
                        alt={person.fullName}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />

                      <div className="absolute bottom-4 left-4">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          {person.fullName}
                        </h3>
                        {person.secondaryLabel && (
                          <p className="text-xs text-slate-200 font-medium uppercase tracking-widest">
                            {person.secondaryLabel}
                          </p>
                        )}
                      </div>

                      {person.badge && (
                        <Badge className="absolute top-4 left-4 bg-emerald-500/90 border-none shadow-lg text-[10px] font-bold">
                          {person.badge}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
