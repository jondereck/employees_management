"use client";

import Image from "next/image";
import * as htmlToImage from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Download, Share2, Gift } from "lucide-react";

type Person = {
  id: string;
  firstName: string;
  lastName?: string | null;
  nickname?: string | null;
  imageUrl?: string | null;
  prefix?: string | null;
  middleName?: string | null;
  suffix?: string | null;
  birthday: string; // ISO date
};

type Props = {
  /** All employees; we’ll filter to current month on the client */
  people: Person[];
  /** Optionally override the month (0–11). Default: current local month. */
  monthOverride?: number;
  /** Background template image (public path). Default: /individual-bday-greet.png */
  backgroundSrc?: string;
  photoZoom?: number;
  photoYOffset?: number;
};

/** === Name helpers (MI only, uppercased) === */
function buildFullName(p: Person) {
  const prefix = (p.prefix ?? "").trim();
  const first = (p.firstName ?? "").trim();
  const mi =
    (p.middleName ?? "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join("") || "";
  const last = (p.lastName ?? "").trim();
  const suffix = (p.suffix ?? "").trim();

  const parts = [
    prefix ? `${prefix}` : "",
    [first, mi ? `${mi}.` : "", last].filter(Boolean).join(" "),
    suffix ? `${suffix}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return parts.toUpperCase();
}
function buildNicknameOrFirst(p: Person) {
  const nick = (p.nickname ?? "").trim();
  if (nick) return nick.toUpperCase();
  return (p.firstName ?? "").trim().toUpperCase();
}

/** Formats “Oct 12” */
function shortDate(dateIso: string) {
  const d = new Date(dateIso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Single square card optimized for mobile (aspect-square) */
function BirthdayCard({
  person,
  useFullName,
  showDate,
  backgroundSrc = "/individual-bday-greet.png",
  photoZoom,
  photoYOffset,

}: {
  person: Person;
  useFullName: boolean;
  showDate: boolean;
  backgroundSrc?: string;
  photoZoom?: number;
  photoYOffset?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const nameBoxRef = useRef<HTMLDivElement>(null);
  const nameSpanRef = useRef<HTMLSpanElement>(null);
  const [nameFontPx, setNameFontPx] = useState<number>(32);

  const name = useFullName ? buildFullName(person) : buildNicknameOrFirst(person);

  const plaqueWidthPct = 58;

  // Fit name on one line
  function fitNameOnce(minPx = 14, maxPx = 40) {
    const box = nameBoxRef.current;
    const span = nameSpanRef.current;
    if (!box || !span) return;
    span.style.whiteSpace = "nowrap";
    span.style.textOverflow = "clip";
    span.style.overflow = "visible";

    let lo = minPx, hi = maxPx, best = minPx;
    for (let i = 0; i < 16; i++) {
      const mid = Math.floor((lo + hi) / 2);
      span.style.fontSize = `${mid}px`;
      const fits = span.scrollWidth <= box.clientWidth;
      if (fits) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    setNameFontPx(best);
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => fitNameOnce());
    return () => cancelAnimationFrame(id);
  }, [name]);

  useEffect(() => {
    const box = nameBoxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => fitNameOnce());
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  async function renderBlob() {
    const node = cardRef.current!;
    const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
    await Promise.allSettled(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve(true);
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true);
            setTimeout(() => resolve(true), 2500);
          })
      )
    );
    const dataUrl = await htmlToImage.toPng(node, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
      style: { width: "1080px", height: "1080px" } as any,
    });
    return await (await fetch(dataUrl)).blob();
  }

  const handleDownload = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const blob = await renderBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}_BirthdayCard.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const blob = await renderBlob();
      const file = new File([blob], `${name}_BirthdayCard.png`, { type: "image/png" });

      const canShareFiles =
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        (navigator as any).canShare?.({ files: [file] });

      if (canShareFiles && "share" in navigator) {
        await (navigator as any).share({
          files: [file],
          title: `${name} — Birthday Greeting`,
          text: "Generated by HRPS",
        });
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full max-w-sm snap-center shrink-0">
      {/* Card preview (square) */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ width: "100%", aspectRatio: "1 / 1" }}
      >
        {/* Background template */}
        <Image
          src={backgroundSrc}
          alt="Birthday Background"
          fill
          priority={false}
          className="object-cover"
        />

        {/* Photo window (centered) */}
        <div
          className="absolute overflow-hidden rounded-2xl"
          style={{
            width: "68%",
            height: "70%",
            left: "50%",
            top: "55%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {person.imageUrl ? (
            <Image
              src={person.imageUrl}
              alt={name}
              fill
              unoptimized
              referrerPolicy="no-referrer"
              className="object-cover"
              style={{
                transform: `scale(${photoZoom ?? 0.85}) translateY(${photoYOffset ?? 0}px)`,
                transformOrigin: "center center",
                objectPosition: "50% 50%",
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
              <span className="text-6xl font-black text-gray-400">
                {name.slice(0, 1) || "?"}
              </span>
            </div>
          )}
        </div>

        {/* Name plaque */}
        <div
          ref={nameBoxRef}
          className="absolute flex items-center justify-center text-center font-black uppercase text-white drop-shadow-xl px-2"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "20px",            // ← tune this to sit perfectly on the badge
            width: `${plaqueWidthPct}%`,// ← use % to match template regardless of device
            height: "60px",
          }}
          title={name}
        >
          <span
            ref={nameSpanRef}
            style={{
              fontSize: `${nameFontPx}px`,
              lineHeight: 1.12,
              whiteSpace: "nowrap",
              overflow: "visible",
              textOverflow: "clip",
              textShadow:
                "0 2px 4px rgba(0,0,0,.75), 0 0 10px rgba(0,0,0,.5), 0 0 2px rgba(0,0,0,.9)",
            }}
          >
            {name}
          </span>
        </div>

        {/* Optional small date chip */}
        {showDate && (
          <div className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {shortDate(person.birthday)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <Button onClick={handleShare} variant="outline" size="sm" disabled={exporting}>
          <Share2 className="mr-1 h-4 w-4" /> Share
        </Button>
        <Button onClick={handleDownload} size="sm" disabled={exporting}>
          <Download className="mr-1 h-4 w-4" /> {exporting ? "Exporting…" : "Download"}
        </Button>
      </div>
    </div>
  );
}

export default function MobileBirthdayGreeter({
  people,
  monthOverride,
  backgroundSrc = "/individual-bday-greet.png",
  photoYOffset,
  photoZoom
}: Props) {
  // Current local month (Asia/Manila assumed server-side; client just uses local)
  const now = new Date();
  const month = (typeof monthOverride === "number" ? monthOverride : now.getMonth()) | 0;

  const [useFullName, setUseFullName] = useState(false);
  const [showDate, setShowDate] = useState(true);

  const celebrants = useMemo(() => {
    return people
      .filter((p) => {
        const d = new Date(p.birthday);
        return d.getMonth() === month;
      })
      .sort((a, b) => {
        const da = new Date(a.birthday).getDate();
        const db = new Date(b.birthday).getDate();
        return da - db;
      });
  }, [people, month]);

  const first = celebrants[0];
  const headerNick =
    (first?.nickname ?? first?.firstName ?? first?.lastName ?? "There").trim();

  return (
    <div className="mx-auto w-full max-w-screen-sm px-3 pb-8">
      {/* Header / controls */}
      <div className="sticky top-0 z-30 -mx-3 mb-3 bg-background/80 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            <h2 className="text-base font-semibold">
              Happy Birthday {headerNick}!
            </h2>
          </div>
        </div>


      </div>

      {celebrants.length === 0 ? (
        <div className="mt-8 rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No birthdays this month.
        </div>
      ) : (
        <>
          {/* Swipeable row */}
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
            {celebrants.map((p) => (
              <BirthdayCard
                key={p.id}
                person={p}
                useFullName={useFullName}
                showDate={showDate}
                backgroundSrc={backgroundSrc}
                photoZoom={0.6}
                photoYOffset={1}
              />
            ))}
          </div>


          <div className="mt-2 flex items-center justify-between gap-3">
            <label htmlFor="toggle-name" className="flex items-center gap-2 text-sm">
              <Switch id="toggle-name" checked={useFullName} onCheckedChange={setUseFullName} />
              Use full name
            </label>
            <label htmlFor="toggle-date" className="flex items-center gap-2 text-sm">
              <Switch id="toggle-date" checked={showDate} onCheckedChange={setShowDate} />
              Show date
            </label>
          </div>
        </>
      )}
    </div>
  );
}
