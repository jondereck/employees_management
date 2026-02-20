"use client";

import * as React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Phone,
  Copy,
  Check,
  Search as SearchIcon,
  ChevronDown,
  X,
  Info,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/** ===== Types ===== */
export type Hotline = {
  id: string;
  name: string;
  subtitle?: string;
  tag?: string;             // e.g., "24/7"
  phones: string[];         // one or more dialable numbers
  sms?: string[];           // optional overrides per number
};

/** ===== Formatting ===== */
const telNumber = (s: string) => (s ?? "").toString().replace(/\D/g, "");
const norm = (s: string) => s.replace(/\s+/g, "").replace(/[()\-\._]/g, "").toLowerCase();

function formatPhDisplay(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("09"))
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith("9"))
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 10 && digits.startsWith("75"))
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return raw;
}

/** ===== Main directory ===== */
export function HotlineDirectory({
  items,
  title = "Lingayen Hotline",
  description = "Search by office or number. Tap to expand for actions.",
  className,
  initialLimit = 5,
  moreStep = 5,
}: {
  items: Hotline[];
  title?: string;
  description?: string;
  className?: string;
   initialLimit?: number;
  moreStep?: number;
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const [limit, setLimit] = useState(initialLimit);

  // reset limit whenever filters change
  React.useEffect(() => {
    setLimit(initialLimit);
  }, [q, tag, initialLimit]);

  // ... keep your existing tags + filtered memo here ...

 
  // Build tag chips (unique, short)
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const t = (it.tag ?? "").trim();
      if (t) set.add(t);
    }
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    const hasQuery = q.trim().length > 0;
    const nQ = norm(q);

    
    const base = items.filter((h) => {
      if (tag && (h.tag ?? "").trim() !== tag) return false;
      if (!hasQuery) return true;

      // text match
      const hay = `${h.name} ${(h.subtitle ?? "")} ${(h.tag ?? "")}`.toLowerCase();
      const textHit = hay.includes(q.toLowerCase());
      // number match (normalize both)
      const numHit = h.phones.some((p) => norm(p).includes(nQ));

      return textHit || numHit;
    });

    if (!hasQuery) {
      // Alphabetical when no query
      return base.slice().sort((a, b) => a.name.localeCompare(b.name));
    }

    // Lightweight relevance: name match first, then subtitle/tag, then phone
    return base
      .map((h) => {
        const nameScore = h.name.toLowerCase().includes(q.toLowerCase()) ? 2 : 0;
        const metaScore =
          ((h.subtitle ?? "").toLowerCase().includes(q.toLowerCase()) ? 1 : 0) +
          ((h.tag ?? "").toLowerCase().includes(q.toLowerCase()) ? 1 : 0);
        const phoneScore = h.phones.some((p) => norm(p).includes(nQ)) ? 1 : 0;
        return { h, score: nameScore + metaScore + phoneScore };
      })
      .sort((a, b) => b.score - a.score || a.h.name.localeCompare(b.h.name))
      .map((x) => x.h);
  }, [items, q, tag]);
  const shown = filtered.slice(0, Math.max(0, limit ?? 0));
  const hasMore = filtered.length > shown.length;
  return (
   <section className={cn("mt-10", className)}>
  {/* Header with Frosted Badge */}
  <div className="mb-5 flex items-center justify-between gap-2 px-1">
    <div>
      <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</h2>
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">{description}</p>
    </div>
    <Badge className="bg-white/40 backdrop-blur-md border-white/60 text-slate-600 font-black text-[10px] px-2.5 py-1 rounded-full shadow-sm">
      {shown.length} / {filtered.length}
    </Badge>
  </div>

  {/* Search Bar - Frosted Input */}
  <div className="relative mb-4 group">
    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
    <Input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search office or number…"
      className="pl-10 pr-10 h-11 bg-white/40 backdrop-blur-xl border-white/40 rounded-2xl shadow-sm focus:bg-white/60 transition-all placeholder:text-slate-400 text-sm font-medium"
      aria-label="Search hotlines"
    />
    {q && (
      <button
        type="button"
        onClick={() => setQ("")}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 bg-slate-200/50 hover:bg-rose-100 hover:text-rose-600 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>

  {/* Tag Chips - Frosted Pills */}
  {tags.length > 0 && (
    <div className="mb-5 flex flex-wrap gap-2 px-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 rounded-full px-4 text-[11px] font-black uppercase tracking-wider transition-all",
          tag === null 
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-700" 
            : "bg-white/40 backdrop-blur-md border border-white/40 text-slate-600 hover:bg-white/60"
        )}
        onClick={() => setTag(null)}
      >
        All
      </Button>
      {tags.map((t) => (
        <Button
          key={t}
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 rounded-full px-4 text-[11px] font-black uppercase tracking-wider transition-all border",
            tag === t 
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border-transparent" 
              : "bg-white/40 backdrop-blur-md border-white/40 text-slate-600 hover:bg-white/60"
          )}
          onClick={() => setTag(tag === t ? null : t)}
        >
          {t}
        </Button>
      ))}
    </div>
  )}

  {/* Main Content Area */}
  {filtered.length === 0 ? (
    <div className="rounded-[2rem] border border-white/40 bg-white/30 backdrop-blur-xl p-10 text-center shadow-xl">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/50 text-slate-400">
        <Info className="h-6 w-6" />
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">No results found</p>
      <p className="text-[11px] text-slate-400 mt-1">Try a different office name or number.</p>
    </div>
  ) : (
    <div className="rounded-[2rem] border border-white/40 bg-white/20 backdrop-blur-2xl shadow-2xl overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        {shown.map((h) => (
          <HotlineRow key={h.id} item={h} />
        ))}
      </Accordion>

      {/* Footer Controls - Glassy Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/40 border-t border-white/20">
        <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
          Showing <span className="text-indigo-600">{shown.length}</span> of {filtered.length}
        </span>
        
        <div className="flex gap-2">
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all"
              onClick={() => setLimit((v) => v + moreStep)}
            >
              Show more
            </Button>
          )}
          {shown.length > initialLimit && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 rounded-lg text-slate-400 text-[10px] font-black uppercase tracking-wider hover:bg-rose-50 hover:text-rose-600"
              onClick={() => setLimit(initialLimit)}
            >
              Show less
            </Button>
          )}
        </div>
      </div>
    </div>
  )}
</section>
  );
}

/** ===== One row ===== */
function HotlineRow({ item }: { item: Hotline }) {
  const count = item.phones.length;
  const hasTag = !!item.tag?.trim();
  const label = hasTag ? item.tag!.trim() : `${count} ${count > 1 ? "numbers" : "number"}`;

  return (
  <AccordionItem
  value={item.id}
  className={cn(
    "border-b border-white/20 last:border-b-0 overflow-hidden transition-all",
    // Match the 2rem rounded corners of the parent container
    "[&:first-child]:rounded-t-[2rem] [&:last-child]:rounded-b-[2rem]"
  )}
>
  <AccordionTrigger
    className={cn(
      "px-5 py-4 hover:no-underline transition-all duration-300",
      "data-[state=open]:bg-white/40 data-[state=open]:backdrop-blur-md group"
    )}
  >
    <div className="flex w-full items-center gap-4 text-left">
      {/* Icon Squircle */}
      <div className="h-10 w-10 shrink-0 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-data-[state=open]:bg-indigo-500 group-data-[state=open]:text-white transition-all duration-300">
        <Phone className="h-4 w-4 text-indigo-600 group-data-[state=open]:text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* TRUNCATED NAME */}
          <span className="text-sm font-bold text-slate-800 truncate leading-tight">
            {item.name}
          </span>
          {hasTag && (
            <Badge className="h-5 bg-white/60 border-white/40 text-[9px] font-black uppercase tracking-widest text-slate-500">
              {item.tag}
            </Badge>
          )}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-tighter text-slate-400 mt-0.5">
          {item.subtitle ?? "Hotline / Directory"}
        </div>
      </div>

      {/* Inline Badge for Desktop */}
      {!hasTag && (
        <div className="hidden sm:block shrink-0">
          <Badge className="h-5 bg-slate-900/5 text-slate-500 text-[9px] font-black uppercase tracking-widest border-none">
            {label}
          </Badge>
        </div>
      )}
    </div>
  </AccordionTrigger>

  <AccordionContent className="px-5 pb-5 pt-2 bg-white/20 backdrop-blur-sm">
    <div className="rounded-2xl border border-white/40 bg-white/30 p-1 shadow-inner">
      <NumbersList item={item} />
    </div>
  </AccordionContent>
</AccordionItem>
  );
}

/** ===== Expanded numbers with quick actions ===== */
function NumbersList({ item }: { item: Hotline }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  return (
   <div className="space-y-3 p-1">
  {item.phones.map((num, idx) => {
    const callNum = telNumber(num);
    const telHref = `tel:${callNum}`;

    return (
      <div
        key={idx}
        className={cn(
          "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
          "bg-white/50 backdrop-blur-md border border-white/60 p-3 rounded-2xl shadow-sm transition-all hover:bg-white/80"
        )}
      >
        {/* Phone Number Display */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-slate-900/5 flex items-center justify-center shrink-0">
            <Hash className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <span className="text-sm font-black tracking-tight text-slate-700 truncate">
            {formatPhDisplay(num)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary: Call Button (Glassy Action) */}
          <Link href={telHref} className="flex-1 sm:flex-none">
            <Button 
              size="sm" 
              className="w-full sm:w-auto gap-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
            >
              <Phone className="h-3.5 w-3.5" /> 
              Call
            </Button>
          </Link>

          {/* Copy Button (Transparent Utility) */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 sm:flex-none gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              copiedIdx === idx 
                ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-100" 
                : "bg-slate-100/50 text-slate-500 hover:bg-slate-200"
            )}
            onClick={async () => {
              try {
                const textToCopy = callNum || num;
                await navigator.clipboard.writeText(textToCopy);
                setCopiedIdx(idx);
                setTimeout(() => setCopiedIdx(null), 1300);
              } catch (e) {
                console.error("Clipboard failed", e);
              }
            }}
            aria-label={`Copy ${formatPhDisplay(num)}`}
          >
            {copiedIdx === idx ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>
    );
  })}
</div>
  );
}
