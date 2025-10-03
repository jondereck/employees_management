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
    <section className={cn("mt-8", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
       <Badge variant="secondary" className="shrink-0">
    {shown.length} / {filtered.length}
  </Badge>

      </div>

      {/* Search + Clear */}
      <div className="relative mb-3">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search office or number…"
          className="pl-8 pr-8"
          aria-label="Search hotlines"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted/60"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Tag chips (optional) */}
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            variant={tag === null ? "default" : "outline"}
            size="sm"
            onClick={() => setTag(null)}
          >
            All
          </Button>
          {tags.map((t) => (
            <Button
              key={t}
              variant={tag === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTag(tag === t ? null : t)}
            >
              {t}
            </Button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          <Info className="mx-auto mb-2 h-5 w-5" />
          No results found. Try a different office name or number.
        </div>
      ) : (
    <div className="rounded-lg border bg-card">
      <Accordion type="single" collapsible className="w-full">
        {shown.map((h) => (
          <HotlineRow key={h.id} item={h} />
        ))}
      </Accordion>

      {/* Footer controls */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 text-xs text-muted-foreground">
        <span>
          Showing <strong>{shown.length}</strong> of <strong>{filtered.length}</strong>
        </span>
        <div className="flex gap-2">
          {hasMore && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit((v) => v + moreStep)}
              >
                Show more
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLimit(filtered.length)}>
                Show all
              </Button>
            </>
          )}
          {shown.length > initialLimit && (
            <Button variant="ghost" size="sm" onClick={() => setLimit(initialLimit)}>
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
        "border-b last:border-b-0",
        // rounded corners on first/last
        "[&:first-child>h3>button]:rounded-t-lg [&:last-child>div]:rounded-b-lg"
      )}
    >
      <AccordionTrigger
        className={cn(
          "px-3 sm:px-4 py-3 hover:no-underline",
          "data-[state=open]:bg-muted/40 transition-colors"
        )}
      >
        <div className="flex w-full items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{item.name}</span>
              {/* show tag inline if present */}
              {hasTag && <Badge variant="outline" className="h-5">{item.tag}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {item.subtitle ?? "Hotline"}
            </div>
          </div>

          {/* Count badge at right when no explicit tag */}
          {!hasTag && (
            <div className="hidden sm:block shrink-0">
              <Badge variant="secondary" className="h-5">
                {label}
              </Badge>
            </div>
          )}

          {/* Custom chevron for consistency */}
       
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-3 sm:px-4 pb-3">
        <NumbersList item={item} />
      </AccordionContent>
    </AccordionItem>
  );
}

/** ===== Expanded numbers with quick actions ===== */
function NumbersList({ item }: { item: Hotline }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {item.phones.map((num, idx) => {
        const callNum = telNumber(num);
        const telHref = `tel:${callNum}`;

        return (
          <div
            key={idx}
            className={cn(
              "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
              "rounded-md border p-2.5"
            )}
          >
            <div className="text-sm font-medium">{formatPhDisplay(num)}</div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Primary: Call */}
              <Link href={telHref} className="w-full sm:w-auto">
                <Button variant="destructive" size="sm" className="w-full sm:w-auto gap-1">
                  <Phone className="h-4 w-4" /> Call
                </Button>
              </Link>

              {/* Copy */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto gap-1"
                onClick={async () => {
                  try {
                    // copy normalized number (dialable)
                    await navigator.clipboard.writeText(callNum);
                    setCopiedIdx(idx);
                    setTimeout(() => setCopiedIdx(null), 1300);
                  } catch {
                    // fallback to raw if clipboard blocked
                    await navigator.clipboard.writeText(num);
                    setCopiedIdx(idx);
                    setTimeout(() => setCopiedIdx(null), 1300);
                  }
                }}
                aria-label={`Copy ${formatPhDisplay(num)}`}
              >
                {copiedIdx === idx ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedIdx === idx ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
