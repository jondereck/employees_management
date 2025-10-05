"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type Person = {
  id: string;
  firstName: string;
  lastName?: string | null;
  nickname?: string | null;
  imageUrl?: string | null;
  prefix?: string | null;
  middleName?: string | null;
  suffix?: string | null;

};


function buildNicknameOrFirst(p: Person) {
  const nick = (p.nickname ?? "").trim();
  if (nick) return nick.toUpperCase();
  return (p.firstName ?? "").trim().toUpperCase();
}

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


function displayName(p: Person) {
  const nick = (p.nickname ?? "").trim();
  if (nick) return nick.toUpperCase();
  const first = (p.firstName ?? "").trim();
  if (first) return first.toUpperCase();
  return (p.lastName ?? "").toUpperCase();
}

export default function IndividualBirthdayCard({
  person,
  /** Optional: slight zoom of the face photo (1 = no zoom) */
  photoZoom = 0.8,
  /** Optional: nudge photo up/down in the window (px at export size) */
  photoYOffset = 1,
}: {
  person: Person;
  photoZoom?: number;
  photoYOffset?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const nameBoxRef = useRef<HTMLDivElement>(null);
  const nameSpanRef = useRef<HTMLSpanElement>(null);
  const [nameFontPx, setNameFontPx] = useState<number>(34); // start big (export pl


  const [useFullName, setUseFullName] = useState(false);
  const name = useFullName ? buildFullName(person) : buildNicknameOrFirst(person);
  // Shrink font until the text fits on one line inside the plaque box
  function fitNameOnce(minPx = 14, maxPx = 42) {
    const box = nameBoxRef.current;
    const span = nameSpanRef.current;
    if (!box || !span) return;

    // Binary search for the largest font-size that fits: span.scrollWidth <= box.clientWidth
    let lo = minPx, hi = maxPx, best = minPx;
    // safety: remove ellipsis and allow single-line measuring
    span.style.whiteSpace = "nowrap";
    span.style.textOverflow = "clip";
    span.style.overflow = "visible";

    for (let i = 0; i < 16; i++) {
      const mid = Math.floor((lo + hi) / 2);
      span.style.fontSize = `${mid}px`;
      // Force layout read
      const fits = span.scrollWidth <= box.clientWidth;
      if (fits) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    setNameFontPx(best);
  }

  // Refit on name change and when plaque resizes
  useEffect(() => {
    // run after paint
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





  // ADD this new function under handleDownload()
  async function handleShare() {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const node = cardRef.current!;
      const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.allSettled(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete && img.naturalWidth > 0) return resolve(true);
              img.onload = () => resolve(true);
              img.onerror = () => resolve(true);
              setTimeout(() => resolve(true), 3000);
            })
        )
      );

      // Render the card to PNG
      const dataUrl = await htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        style: { width: "1080px", height: "1080px" } as any,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${name}_BirthdayCard.png`, { type: "image/png" });

      // ✅ Web Share API (best on mobile)
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
        return;
      }

      // 💡 Fallback: open in a new tab
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setExporting(false);
    }
  }


  const handleDownload = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const node = cardRef.current!;
      const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.allSettled(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete && img.naturalWidth > 0) return resolve(true);
              img.onload = () => resolve(true);
              img.onerror = () => resolve(true);
              setTimeout(() => resolve(true), 3000);
            })
        )
      );

      const dataUrl = await htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        // render at full design size even if preview is smaller
        style: { width: "1080px", height: "1080px" } as any,
      });

      const blob = await (await fetch(dataUrl)).blob();
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

  /**
   * Layout notes for your template (1080 x 1080 design space):
   * - Photo window: centered box ~ 64% width x 38% height, vertically around 41% from top.
   *   We clip via overflow + rounded corners so the portrait stays perfectly centered.
   * - Name plaque: centered container over the silver bar; we center the text vertically.
   */
  return (

    <div className="flex flex-col items-center gap-4">
      {/* On-screen preview at 540×540; export renders at 1080×1080 */}
      <div className="w-full max-w-[540px] flex items-center justify-between gap-2" data-hide-in-export>
        <div className="flex items-center gap-2">
          <Switch id="nameMode" checked={useFullName} onCheckedChange={setUseFullName} />
          <label htmlFor="nameMode" className="text-sm select-none cursor-pointer">
            Use full name
          </label>
        </div>
      </div>
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-xl border shadow bg-white"
        style={{ width: 540, height: 540 }}
      >

        {/* Fixed background template */}
        <Image
          src="/individual-bday-greet.png"
          alt="Birthday Background"
          fill
          priority
          className="object-cover"
        />

        {/* --- CENTERED PHOTO WINDOW --- */}
        <div
          className="absolute overflow-hidden rounded-2xl"
          style={{
            // Centered box: ~64% of width, ~38% of height, centered both axes
            width: "60%",          // adjust if needed
            height: "55%",         // adjust if needed
            left: "49.5%",
            top: "54%",            // vertical position of the window's center
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
              // Keep the face centered; slight zoom & vertical nudge supported
              style={{
                // Scale around center
                transform: `scale(${photoZoom}) translateY(${photoYOffset}px)`,
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


        {/* --- CENTERED NAME ON THE PLAQUE --- */}
        <div
          ref={nameBoxRef}                                   // 👈 add
          className="absolute flex items-center justify-center text-center font-black uppercase text-white drop-shadow-xl px-4 sm:px-6"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "50px",
            width: "60%",          // keep a bit wider for full names
            height: "64px",
            letterSpacing: "0.06em",
          }}
          title={name}
        >
          <span
            ref={nameSpanRef}                                // 👈 add
            style={{
              fontSize: `${nameFontPx}px`,                   // 👈 dynamic size
              lineHeight: 1.12,
              whiteSpace: "nowrap",                          // single line
              overflow: "visible",                           // no ellipsis
              textOverflow: "clip",
              textShadow:
                "0 2px 4px rgba(0,0,0,.75), 0 0 10px rgba(0,0,0,.5), 0 0 2px rgba(0,0,0,.9)",
            }}
          >
            {name}
          </span>
        </div>

      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleShare}
          disabled={exporting}
          variant="outline"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>

        <Button onClick={handleDownload} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exporting…" : "Download PNG"}
        </Button>
      </div>
    </div>
  );
}
