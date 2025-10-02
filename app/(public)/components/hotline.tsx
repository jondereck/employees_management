"use client";

import * as React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Phone, MessageSquare, Copy, Check, Search as SearchIcon, ChevronDown } from "lucide-react";
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


const telNumber = (s: string) => (s ?? "").toString().replace(/\D/g, "");
/** ===== Utility ===== */
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
}: {
  items: Hotline[];
  title?: string;
  description?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const needle = q.replace(/\s+/g, "").toLowerCase();
    return items.filter((h) => {
      const byName =
        h.name.toLowerCase().includes(needle) ||
        (h.subtitle ?? "").toLowerCase().includes(needle) ||
        (h.tag ?? "").toLowerCase().includes(needle);
      const byPhone = h.phones.some((p) => p.replace(/\D/g, "").includes(needle));
      return byName || byPhone;
    });
  }, [items, q]);

  return (
    <section className={cn("mt-8", className)}>
      <div className="mb-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search office or number…"
          className="pl-8"
        />
        <div className="mt-1 text-xs text-muted-foreground">
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Compact, collapsible list */}
      <div className="rounded-lg border bg-card">
        <Accordion type="single" collapsible className="w-full">
          {filtered.map((h) => (
            <HotlineRow key={h.id} item={h} />
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/** ===== One row (compact header, expandable content) ===== */
function HotlineRow({ item }: { item: Hotline }) {

  const count = item.phones.length;
  const label = item.tag ? item.tag : `${count} ${count > 1 ? "numbers" : "number"}`;

  return (
    <AccordionItem value={item.id} className="border-b last:border-b-0">
          <AccordionTrigger className="px-3 sm:px-4 py-2.5 hover:no-underline">
        <div className="flex w-full items-center gap-2">
          {/* LEFT: name + subtitle (+ mobile badge) */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{item.name}</span>
              {/* optional tag alongside name if you still want it */}
              {/* {item.tag ? <Badge variant="outline" className="h-5">{item.tag}</Badge> : null} */}
            </div>

            <div className="text-xs text-muted-foreground truncate">
              {item.subtitle ?? "Hotline"}
            </div>

            {/* Mobile placement: badge under subtitle (LEFT) */}
            <div className="mt-1 sm:hidden">
              <Badge variant="secondary" className="h-5">
                {label}
              </Badge>
            </div>
          </div>

          {/* Desktop/tablet placement: badge on the RIGHT */}
          <div className="hidden sm:block shrink-0">
            <Badge variant="secondary" className="h-5">
              {label}
            </Badge>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-3 sm:px-4 pb-3">
        <NumbersList item={item} />
      </AccordionContent>
    </AccordionItem>
  );
}

/** ===== Expanded numbers with quick actions (still neat) ===== */
function NumbersList({ item }: { item: Hotline }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {item.phones.map((num, idx) => {
        const callNum = telNumber(num);
        const smsNum = telNumber(item.sms?.[idx] ?? num);

        const telHref = `tel:${callNum}`;
        const smsHref = `sms:${smsNum}`;
        return (
          <div key={idx} className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">{formatPhDisplay(num)}</div>
            <div className="flex items-center gap-1">
              <Link href={telHref}>
                <Button variant="secondary" size="sm" className="gap-1">
                  <Phone className="h-4 w-4" /> Call
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={async () => {
                  await navigator.clipboard.writeText(num);
                  setCopiedIdx(idx);
                  setTimeout(() => setCopiedIdx(null), 1200);
                }}
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
