"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import { Bold, CalendarDays, Copy, Download, ExternalLink, Italic, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getMonthDayInTimeZone } from "@/lib/birthday";

type Person = {
  id: string;
  firstName: string;
  lastName?: string | null;
  nickname?: string | null;
  imageUrl?: string | null;
  prefix?: string | null;
  middleName?: string | null;
  suffix?: string | null;
  officeName?: string | null;
  birthday?: string | Date | null;
};

const FACEBOOK_BUSINESS_POSTS_URL = "https://business.facebook.com/latest/posts/";
const BIRTHDAY_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const BOLD_UPPER_START = 0x1d400;
const BOLD_LOWER_START = 0x1d41a;
const BOLD_DIGIT_START = 0x1d7ce;
const ITALIC_UPPER_START = 0x1d434;
const ITALIC_LOWER_START = 0x1d44e;

function buildNicknameOrFirst(person: Person) {
  const nickname = (person.nickname ?? "").trim();
  if (nickname) return nickname.toUpperCase();
  return (person.firstName ?? "").trim().toUpperCase();
}

function buildFullName(person: Person) {
  const prefix = (person.prefix ?? "").trim();
  const first = (person.firstName ?? "").trim();
  const middleInitial =
    (person.middleName ?? "")
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .filter(Boolean)
      .join("") || "";
  const last = (person.lastName ?? "").trim();
  const suffix = (person.suffix ?? "").trim();

  return [prefix, [first, middleInitial ? `${middleInitial}.` : "", last].filter(Boolean).join(" "), suffix]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function styleChar(char: string, style: "bold" | "italic") {
  const code = char.codePointAt(0);
  if (code == null) return char;

  if (code >= 65 && code <= 90) {
    return String.fromCodePoint((style === "bold" ? BOLD_UPPER_START : ITALIC_UPPER_START) + code - 65);
  }

  if (code >= 97 && code <= 122) {
    return String.fromCodePoint((style === "bold" ? BOLD_LOWER_START : ITALIC_LOWER_START) + code - 97);
  }

  if (style === "bold" && code >= 48 && code <= 57) {
    return String.fromCodePoint(BOLD_DIGIT_START + code - 48);
  }

  return char;
}

function styleText(value: string, style: "bold" | "italic") {
  return Array.from(value).map((char) => styleChar(char, style)).join("");
}

function formatBirthday(value?: string | Date | null) {
  if (!value) return "Birthday date not set";
  const monthDay = getMonthDayInTimeZone(value);
  if (!monthDay) return "Birthday date not set";
  return `${BIRTHDAY_MONTH_NAMES[monthDay.month - 1]} ${monthDay.day}`;
}

export default function IndividualBirthdayCard({
  departmentId,
  month,
  year,
  person,
  photoZoom = 0.8,
  photoYOffset = 1,
}: {
  departmentId: string;
  month: number;
  year: number;
  person: Person;
  photoZoom?: number;
  photoYOffset?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nameBoxRef = useRef<HTMLDivElement>(null);
  const nameSpanRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preparedImageUrl, setPreparedImageUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [nameFontPx, setNameFontPx] = useState(34);
  const [useFullName, setUseFullName] = useState(true);
  const name = useFullName ? buildFullName(person) : buildNicknameOrFirst(person);
  const birthdayLabel = formatBirthday(person.birthday);

  function fitNameOnce(minPx = 14, maxPx = 42) {
    const box = nameBoxRef.current;
    const span = nameSpanRef.current;
    if (!box || !span) return;

    let low = minPx;
    let high = maxPx;
    let best = minPx;
    span.style.whiteSpace = "nowrap";
    span.style.textOverflow = "clip";
    span.style.overflow = "visible";

    for (let index = 0; index < 16; index += 1) {
      const mid = Math.floor((low + high) / 2);
      span.style.fontSize = `${mid}px`;
      const fits = span.scrollWidth <= box.clientWidth;
      if (fits) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    setNameFontPx(best);
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitNameOnce());
    return () => cancelAnimationFrame(frame);
  }, [name]);

  useEffect(() => {
    const box = nameBoxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => fitNameOnce());
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  async function copyText(value: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }

  function downloadDataUrl(dataUrl: string, filename: string) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function captureCardPng() {
    if (!cardRef.current) return null;

    const node = cardRef.current;
    const images = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
    await Promise.allSettled(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve(true);
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true);
            setTimeout(() => resolve(true), 3000);
          })
      )
    );

    return htmlToImage.toPng(node, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
      style: { width: "1080px", height: "1080px" } as any,
    });
  }

  async function generateCaption() {
    const response = await fetch(`/api/${departmentId}/birthdays/facebook-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "individual",
        month,
        year,
        personId: person.id,
        prepareOnly: true,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload?.caption !== "string") {
      throw new Error(payload?.error || "Unable to generate the Facebook caption.");
    }

    return payload.caption.trim();
  }

  async function prepareFacebookPost() {
    if (generating) return;

    const text = caption.trim();
    if (!text) {
      toast.error("Generate or type a caption first.");
      return;
    }

    try {
      const facebookTab = window.open(FACEBOOK_BUSINESS_POSTS_URL, "_blank", "noopener,noreferrer");
      await copyText(text);
      if (!facebookTab) {
        window.open(FACEBOOK_BUSINESS_POSTS_URL, "_blank", "noopener,noreferrer");
      }

      toast.success("Caption copied. Attach the birthday image in Business Manager when ready.");
    } catch (error) {
      console.error("Failed to prepare individual Facebook post", error);
      toast.error("Unable to copy the caption.");
    }
  }

  async function generateCaptionForEditor() {
    if (generating) return;

    setGenerating(true);
    try {
      const nextCaption = await generateCaption();
      setCaption(nextCaption);
      toast.success("Caption generated.");
    } catch (error) {
      console.error("Failed to regenerate birthday caption", error);
      toast.error(error instanceof Error ? error.message : "Unable to generate the caption.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyCaption() {
    if (!caption.trim()) {
      toast.error("No caption to copy yet.");
      return;
    }

    await copyText(caption);
    toast.success("Caption copied.");
  }

  function applyCaptionStyle(style: "bold" | "italic") {
    const textarea = captionRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;

    const selected = caption.slice(start, end);
    const replacement = styleText(selected, style);
    const nextCaption = `${caption.slice(0, start)}${replacement}${caption.slice(end)}`;
    setCaption(nextCaption);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + replacement.length);
    });
  }

  const handleDownload = async () => {
    if (!cardRef.current || exporting) return;

    setExporting(true);
    try {
      const dataUrl = await captureCardPng();
      if (!dataUrl) return;
      setPreparedImageUrl(dataUrl);
      downloadDataUrl(dataUrl, `${name}_BirthdayCard.png`);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPreparedImage = async () => {
    if (preparedImageUrl) {
      downloadDataUrl(preparedImageUrl, `${name}_${year}_BirthdayCard_Facebook.png`);
      return;
    }

    await handleDownload();
  };

  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[540px_minmax(360px,1fr)]">
      <div className="flex min-h-[640px] w-full flex-col items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="h-7" data-hide-in-export />

        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-xl border shadow bg-white"
          style={{ width: 540, height: 540 }}
        >
          <Image
            src="/individual-bday-greet.png"
            alt="Birthday Background"
            fill
            priority
            className="object-cover"
          />

          <div
            className="absolute overflow-hidden rounded-2xl"
            style={{
              width: "60%",
              height: "55%",
              left: "49.5%",
              top: "54%",
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
                  transform: `scale(${photoZoom}) translateY(${photoYOffset}px)`,
                  transformOrigin: "center center",
                  objectPosition: "50% 50%",
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <span className="text-6xl font-black text-gray-400">{name.slice(0, 1) || "?"}</span>
              </div>
            )}
          </div>

          <div
            ref={nameBoxRef}
            className="absolute flex items-center justify-center text-center font-black uppercase text-white drop-shadow-xl px-4 sm:px-6"
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              bottom: "50px",
              width: "60%",
              height: "64px",
              letterSpacing: "0.06em",
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
        </div>

        <div className="h-10" data-hide-in-export />
      </div>

      <aside className="flex min-h-[640px] w-full flex-col rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Facebook caption</h3>
              <p className="text-xs text-muted-foreground">Edit before pasting into Business Manager.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{birthdayLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="nameMode" checked={useFullName} onCheckedChange={setUseFullName} />
              <label htmlFor="nameMode" className="text-sm select-none cursor-pointer">
                Use full name
              </label>
            </div>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap gap-2">
          <Button type="button" variant="default" size="sm" onClick={generateCaptionForEditor} disabled={generating}>
            <Wand2 className="mr-2 h-4 w-4" />
            {generating ? "Generating..." : caption ? "Generate Again" : "Generate Caption"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => applyCaptionStyle("bold")}
            title="Bold (Ctrl+B)"
            aria-label="Bold selected text"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => applyCaptionStyle("italic")}
            title="Italic (Ctrl+I)"
            aria-label="Italic selected text"
          >
            <Italic className="h-4 w-4" />
          </Button>
        </div>

        <Textarea
          ref={captionRef}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onKeyDown={(event) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            const key = event.key.toLowerCase();
            if (key === "b") {
              event.preventDefault();
              applyCaptionStyle("bold");
            }
            if (key === "i") {
              event.preventDefault();
              applyCaptionStyle("italic");
            }
          }}
          placeholder="Click Generate Caption or type your Facebook caption here..."
          className="min-h-[390px] flex-1 resize-none whitespace-pre-wrap text-sm leading-6"
        />

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" variant="outline" onClick={copyCaption}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button type="button" variant="outline" onClick={prepareFacebookPost} disabled={generating}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open
          </Button>
          <Button type="button" onClick={handleDownloadPreparedImage} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            Image
          </Button>
        </div>
      </aside>
    </div>
  );
}
