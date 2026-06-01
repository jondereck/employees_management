"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import usePreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/hooks/use-preview-modal";

import {
  loadGenioCache,
  saveGenioCache,
  clearGenioCache,
} from "@/lib/genio-cache";


import { nanoid } from "nanoid";

import Image from "next/image";
import {
  Maximize2,
  Mic,
  Minimize2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { extractStats, removeVisualizedStats } from "@/src/genio/utils";
import { AnimatedMarkdown } from "@/src/genio/components/AnimatedMarkdown";
import { GenioStatCard } from "@/src/genio/components/GenioStatCard";


type GenioMessage = {
  id: string;
  role: "user" | "ai";
  context?: GenioContext;
  content: string;
  employeeId?: string;
  canExport?: boolean;
};

type GenioContext = {
  lastResult?: {
    type: string;
    filters?: Record<string, unknown>;
    employeeIds?: string[];
    officeIds?: string[];
    label?: string;
  };
  lastEmployeeId?: string;
  lastOfficeId?: string;
  lastOfficeName?: string;
  signature?: string;
};

const THINKING_MESSAGE = "__thinking__";
const EXPORTING_MESSAGE = "__exporting__";
const EXPORT_STARTED_MESSAGE = "Excel export started. Check your Downloads folder.";
const EXPORT_STARTED_VISIBLE_MS = 5000;
const EXPORT_WATCHDOG_MS = 12000;

function getDownloadFilename(res: Response) {
  const disposition = res.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || "employees-export.xlsx";
}

function getLatestGenioContext(messages: GenioMessage[]) {
  return (
    [...messages].reverse().find((message) => message.role === "ai" && message.context)
      ?.context ?? null
  );
}

export const GENIO_COMMANDS = [
  /* ================= EMPLOYEE LOOKUP ================= */

  {
    label: "Who is an employee",
    value: "/whois",
    template: "Who is [employee name]?",
    quickChip: true,
    examples: [
      "Who is Juan Dela Cruz?",
      "Sino si Maria Santos?",
    ],
  },

  {
    label: "Employees by employee number prefix",
    value: "/who-bio",
    template: "Who are employees starting with BIO [number]",
    quickChip: true,
    examples: [
      "Who are employees starting with BIO715",
      "Who are employees start with bio 715",
      "BIO715",
    ],
  },


  /* ================= MULTIPLE / ADVANCED LOOKUP ================= */

  {
    label: "Who are employees",
    value: "/whoare",
    template: "Who are [employee names or numbers]?",
    quickChip: true,
    examples: [
      "Who are Juan Dela Cruz and Maria Santos?",
      "Who are 7150042, 7150084?",
      "Sino sina Juan at Maria?",
    ],
  },

  {
    label: "Who has note",
    value: "/whonote",
    template: "Who has note: [keyword, keyword]",
    quickChip: true,
    examples: [
      "Who has note: angelie",
      "Who has note: payroll, leave",
      "May note na angelie",
    ],
  },


  {
    label: "Check if employee is office head",
    value: "/ishead",
    template: "Is [name] the head of [office]?",
    quickChip: true,
    examples: [
      "Is Juan Dela Cruz the head of HRMO?",
      "Head ba si Maria Santos ng Accounting?",
    ],
  },

  {
    label: "Who is the head of an office",
    value: "/headoffice",
    template: "Head of [office]?",
    quickChip: true,
    examples: [
      "Who is the head of HRMO?",
      "Sino ang head ng Engineering?",
    ],
  },

  /* ================= OFFICE STRUCTURE ================= */

  {
    label: "List all offices",
    value: "/offices",
    template: "List all offices",
    quickChip: true,
    examples: [
      "List all offices",
      "Anong mga opisina meron?",
    ],
  },

  {
    label: "List office heads",
    value: "/list-heads",
    template: "List all office heads",
    quickChip: true,
    examples: [
      "List all office heads",
      "Sino-sino ang mga department heads?",
    ],
  },

  {
    label: "Offices without a head",
    value: "/no-head",
    template: "Which offices don’t have a head?",
    quickChip: true,
    examples: [
      "Which offices have no head?",
      "Aling opisina ang walang head?",
    ],
  },

  {
    label: "Top offices by size",
    value: "/top-offices",
    template: "Top offices by number of employees",
    quickChip: true,
    examples: [
      "Top offices by size",
      "Pinakamalaking opisina?",
    ],
  },

  {
    label: "Smallest office",
    value: "/smallest-office",
    template: "Which is the smallest office?",
    quickChip: true,
    examples: [
      "Smallest office",
      "Pinakamaliit na opisina?",
    ],
  },

  /* ================= COUNTS ================= */

  {
    label: "Total employees",
    value: "/count",
    template: "How many employees are there?",
    quickChip: true,
    examples: [
      "How many employees are there?",
      "Ilan ang empleyado?",
    ],
  },

  {
    label: "Count by office",
    value: "/count-office",
    template: "How many employees are in [office]?",
    quickChip: true,
    examples: [
      "How many employees are in HRMO?",
      "Ilan ang empleyado sa Accounting?",
    ],
  },

  {
    label: "Count by gender",
    value: "/count-gender",
    template: "How many [male/female] employees are there?",
    quickChip: true,
    examples: [
      "How many female employees?",
      "Ilan ang lalaki?",
    ],
  },

  {
    label: "Count by employee type",
    value: "/count-type",
    template: "How many [employee_type] employees are there?",
    quickChip: true,
    examples: [
      "How many regular employees?",
      "Ilan ang COS?",
    ],
  },

  {
    label: "Current employees by year",
    value: "/count-current-by-year",
    template: "How many current employees as of [year]?",
    quickChip: true,
    examples: [
      "How many current employees as of 2024?",
      "Employees as of year 2022",
      "Ilan ang empleyado noong 2023?",
      "Current employees by year",
    ],
  },


  /* ================= ANALYTICS ================= */

  {
    label: "Gender distribution",
    value: "/distribution",
    template: "Show gender distribution",
    quickChip: true,
    examples: [
      "Gender distribution",
      "Ilan ang lalaki at babae?",
    ],
  },

  {
    label: "Office insights",
    value: "/insight",
    template: "Give insights about [office]",
    quickChip: true,
    examples: [
      "Why is HR understaffed?",
      "Bigyan mo ako ng insight sa Accounting",
    ],
  },
  /* ================= AGE ANALYTICS ================= */
  {
    label: "Age Below/Above",
    value: "/age-below-above",
    template: "Employees [above/below] [age]?",
    quickChip: true,
    examples: [
      "How many employees above 40?",
      "Ilan ang below 30?",
    ],
  },

    {
    label: "Age Between",
    value: "/age-between",
    template: "Employees [between] [min] and [max]?",
    quickChip: true,
    examples: [
      "How many employees between 20-25?",
      "Ilan ang may 20-25 taon?",
    ],
  },

   {
    label: "Age exact",
    value: "/age-exact",
    template: "Employees aged [age]?",
    quickChip: true,
    examples: [
      "How many employees exact 20?",
      "Ilan ang may 20 taon?",
    ],
  },


     {
    label: "Age distribution",
    value: "/age-distribution",
    template: "Show age distribution",
    quickChip: true,
    examples: [
      "How many employees exact 20?",
      "Ilan ang may 20 taon?",
    ],
  },


 /* ================= TENURE ANALYTICS ================= */
  {
    label: "Tenure analysis",
    value: "/tenure",
    template: "Employees worked for at least [years] years",
    quickChip: true,
    examples: [
      "Employees with more than 10 years",
      "Ilan ang may 20 years sa serbisyo?",
    ],
  },

   


  /* ================= COMPARISONS ================= */

  {
    label: "Compare offices",
    value: "/compare-offices",
    template: "Compare [office A] and [office B]",
    quickChip: true,
    examples: [
      "Compare HR and Accounting",
      "HR vs Engineering",
    ],
  },

  {
    label: "Compare employee types",
    value: "/compare-types",
    template: "Compare employee types of [office A] and [office B]",
    quickChip: true,
    examples: [
      "Compare employee types of HR and Accounting",
      "COS vs Regular in Finance and Admin",
    ],
  },


];

const isMobile = typeof window !== "undefined" &&
  window.matchMedia("(max-width: 640px)").matches;



const COMMAND_GROUPS = {
  Employees: GENIO_COMMANDS.filter(c =>
    ["whois", "whoare", "who", "who-bio", "profile", "ishead"].includes(c.value.replace("/", ""))
  ),
  Offices: GENIO_COMMANDS.filter(c =>
    c.value.includes("office")
  ),
  Counts: GENIO_COMMANDS.filter(c =>
    c.value.includes("count")
  ),
  Analytics: GENIO_COMMANDS.filter(c =>
    ["tenure", "insight"].some(k =>
      c.value.includes(k)
    )
  ),
   Age: GENIO_COMMANDS.filter(c =>
    ["age", "insight"].some(k =>
      c.value.includes(k)
    )
  ),
};

const messagesLoad = [
  "Analyzing HR records…",
  "Cross-checking employee data…",
  "Reviewing department insights…",
];
export const GenioChat = ({
  onClose,

  departmentId,
  hidden,
  prefill = null
}: {
  prefill?: string | null
  onClose: () => void;
  departmentId: string;
  hidden: boolean;
}) => {
  const previewModal = usePreviewModal();



  const [messages, setMessages] = useState<GenioMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<
    Record<string, boolean>
  >({});
  const [showCommands, setShowCommands] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [selectionText, setSelectionText] = useState("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [visibleChips, setVisibleChips] = useState<typeof GENIO_COMMANDS>([]);
  const [showCommandSheet, setShowCommandSheet] = useState(false);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionText("");
        setSelectionRect(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectionText(text);
      setSelectionRect(rect);
    };

    document.addEventListener("selectionchange", handleSelection);
    return () =>
      document.removeEventListener("selectionchange", handleSelection);
  }, []);


  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");

    const handleChange = () => {
      setIsMobile(media.matches);
    };

    handleChange(); // init
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsFullscreen(true);
    }
  }, [isMobile]);


  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messagesLoad.length);
    }, 2000); // change every 2 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);


  const bottomRef = useRef<HTMLDivElement | null>(null);
  const commandRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const latestContextRef = useRef<GenioContext | null>(null);
  const cacheDepartmentRef = useRef<string | null>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  useEffect(() => {
    resizeTextarea();
  }, [input]);


  useEffect(() => {
  if (!prefill) return;

  setInput(prefill);
  requestAnimationFrame(() => {
    inputRef.current?.focus();
    resizeTextarea();
  });
}, [prefill]);






  /* ================= SEND MESSAGE ================= */

  const sendMessage = async (preset?: string) => {
    const text = preset ?? input;
    if (!text.trim() || isLoading) return;
    const isExportRequest = /\b(export|download|excel|i-export)\b/i.test(text);
    let exportWatchdog: number | null = null;


    setInput("");
    setIsLoading(true);



    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: GenioMessage = {
      id: nanoid(),
      role: "user",
      content: text,
    };

    const aiId = nanoid();

    setMessages((prev) => [...prev, userMsg]);

    const shouldShowAI = true;

    if (shouldShowAI) {
      setMessages((prev) => [
        ...prev,
        {
          id: aiId,
          role: "ai",
          content: isExportRequest ? EXPORTING_MESSAGE : THINKING_MESSAGE,
          context: undefined,
        },
      ]);
    }

    if (isExportRequest && typeof window !== "undefined") {
      exportWatchdog = window.setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId && m.content === EXPORTING_MESSAGE
              ? { ...m, content: EXPORT_STARTED_MESSAGE }
              : m
          )
        );
        setIsLoading(false);
        window.setTimeout(() => {
          setMessages((prev) =>
            prev.filter((m) => m.id !== aiId || m.content !== EXPORT_STARTED_MESSAGE)
          );
        }, EXPORT_STARTED_VISIBLE_MS);
      }, EXPORT_WATCHDOG_MS);
    }


    const lastAIContext = latestContextRef.current;
    try {
      const res = await fetch(`/api/${departmentId}/genio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: lastAIContext,
          clientMeta: {
            locale: typeof navigator !== "undefined" ? navigator.language : undefined,
            languageHint: typeof navigator !== "undefined" ? navigator.language?.split("-")[0] : undefined,
          },
        }),

        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Genio request failed with status ${res.status}`);
      }

      const ctx = res.headers.get("x-genio-context");

      if (ctx) {
        try {
          const parsed = JSON.parse(ctx) as GenioContext;
          latestContextRef.current = parsed;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId ? { ...m, context: parsed } : m
            )
          );


        } catch (e) {
          console.error("Failed to parse genio context", e);
        }
      }




      /* ===============================
         📦 CSV EXPORT (MUST BE FIRST)
         =============================== */
      if (
        res.headers
          .get("content-type")
          ?.includes(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
      ) {
        if (exportWatchdog) {
          window.clearTimeout(exportWatchdog);
          exportWatchdog = null;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const filename = getDownloadFilename(res);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: EXPORT_STARTED_MESSAGE }
              : m
          )
        );

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        window.setTimeout(() => {
          setMessages((prev) =>
            prev.filter((m) => m.id !== aiId || m.content !== EXPORT_STARTED_MESSAGE)
          );
        }, EXPORT_STARTED_VISIBLE_MS);

        return;
      }


      /* ===============================
         💬 STREAMING RESPONSE
         =============================== */
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      readerRef.current = reader;

      const decoder = new TextDecoder();
      let aiText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        aiText += decoder.decode(value);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, content: aiText } : m
          )
        );
      }


      /* ===============================
         🧾 META (View Profile)
         =============================== */
      const meta = res.headers.get("x-genio-meta");
      if (meta) {
        const parsed = JSON.parse(meta);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                ...m,
                employeeId: parsed.viewProfileEmployeeId,
                canExport: parsed.canExport,
              }
              : m
          )
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId && (m.content === THINKING_MESSAGE || m.content === EXPORTING_MESSAGE)
            ? { ...m, content: "Something went wrong." }
            : m
        )
      );
    } finally {
      if (exportWatchdog) {
        window.clearTimeout(exportWatchdog);
        exportWatchdog = null;
      }
      setIsLoading(false);
      abortControllerRef.current = null;
      readerRef.current = null;
    }
  };



  useEffect(() => {
    if (typeof window === "undefined") return;

    const previousDepartmentId = cacheDepartmentRef.current;
    const departmentChanged =
      previousDepartmentId !== null && previousDepartmentId !== departmentId;
    cacheDepartmentRef.current = departmentId;

    latestContextRef.current = null;
    setMessages([]);
    if (departmentChanged) {
      setInput("");
    }

    const cached = loadGenioCache();
    if (!cached) return;
    if (cached.departmentId && cached.departmentId !== departmentId) return;

    const cachedMessages = Array.isArray(cached.messages)
      ? (cached.messages as GenioMessage[])
      : [];
    const cachedContext =
      (cached.context as GenioContext | null | undefined) ??
      getLatestGenioContext(cachedMessages);

    latestContextRef.current = cachedContext ?? null;
    setMessages(cachedMessages);
    setInput(cached.input ?? "");
  }, [departmentId]);

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {

    if (typeof window === "undefined") return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      saveGenioCache({
        departmentId,
        messages,
        input,
        context: latestContextRef.current,
      });
    }, 300);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [departmentId, messages, input]);


  const MAX_VISIBLE_LINES = 8;

  const toggleExpand = (id: string) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };
  const filteredCommands = input.startsWith("/")
    ? GENIO_COMMANDS.filter(cmd =>
      cmd.value.startsWith(input.trim())
    )
    : [];



  const resizeTextarea = () => {
    const el = inputRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };


  useEffect(() => {
    if (!showCommands) return;

    const el = commandRefs.current[activeCommandIndex];
    if (!el) return;

    el.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeCommandIndex, showCommands]);



  useEffect(() => {
    commandRefs.current = new Array(filteredCommands.length);
    setActiveCommandIndex(0);
  }, [filteredCommands.length]);


  const stopGenerating = () => {
    abortControllerRef.current?.abort();
    readerRef.current?.cancel();

    abortControllerRef.current = null;
    readerRef.current = null;

    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "ai" && (m.content === THINKING_MESSAGE || m.content === EXPORTING_MESSAGE)
          ? { ...m, content: m.content === EXPORTING_MESSAGE ? "Export cancelled." : "Request stopped." }
          : m
      )
    );
  };

  const getRandomCommands = () => {
    const shuffled = [...GENIO_COMMANDS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2);
  };




  useEffect(() => {
    if (hidden) return;
    setVisibleChips(getRandomCommands());
  }, [hidden]);


  const handleRefreshClick = () => {
    // if long-press already triggered, do nothing
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    setShowCommandSheet(false);
    setVisibleChips(getRandomCommands());
  };

  const handleLongPressStart = () => {
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setShowCommandSheet(true);
    }, 500); // ⏱ long press threshold
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };


  const handleChipClick = (cmd: typeof GENIO_COMMANDS[number]) => {
    setInput(cmd.template);          // put text in input
    setShowCommands(false);          // hide dropdown if any

    requestAnimationFrame(() => {
      inputRef.current?.focus();     // focus input
      resizeTextarea();              // adjust height
    });
  };

  return (
    <div
      className={`
    flex flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl shadow-slate-900/15
    transition-all duration-300
    ${hidden ? "hidden" : ""}

    ${isFullscreen
          ? "fixed inset-x-0 bottom-0 top-[56px] z-[100] h-[calc(100dvh-56px)] w-screen rounded-none sm:inset-x-0 sm:bottom-0 sm:top-[76px] sm:h-[calc(100vh-76px)]"
          : "h-[620px] w-[min(420px,calc(100vw-32px))] max-h-[calc(100vh-48px)] rounded-3xl"
        }
  `}
      aria-label="Genio AI Chat Box"
    >




      {/* HEADER */}
      <div className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">




          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-600">
            <Image
              src="/genio/genio-avatar.png"
              alt="Genio AI"
              fill
              className="rounded-2xl object-contain p-1"
              priority
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />


          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-black text-slate-950">Genio</p>
              <Sparkles size={13} className="text-violet-500" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">


          {/* Reset*/}

          <button
            className="grid h-9 w-9 place-items-center rounded-xl text-rose-500 transition hover:bg-rose-50"
            onClick={() => {
              clearGenioCache();
              latestContextRef.current = null;
              setMessages([]);

              setInput("");
            }}
            aria-label="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {/* Fullscreen*/}
          {!isMobile && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100"
              aria-label={isFullscreen ? "Minimize chat" : "Expand chat"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          {/* Close */}
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100"
            title="Close"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* {latestAIContext && (
  <div className="border-b bg-muted/40 px-4 py-2 text-[11px]">
    <span className="font-medium">Context:</span>
    {latestAIContext.employeeTypeName && (
      <> Employee Type: {latestAIContext.employeeTypeName}</>
    )}
    {latestAIContext.year && <> · Year: {latestAIContext.year}</>}
  </div>
)} */}



      {visibleChips.length > 0 && (
        <div className="border-b border-slate-200 bg-white/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="custom-scrollbar-thin flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {visibleChips.map((cmd) => (
                <button
                  key={cmd.value}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:pointer-events-none disabled:opacity-50"
                  disabled={isLoading}
                  onClick={() => handleChipClick(cmd)}
                >
                  {cmd.label}
                </button>
              ))}
            </div>

            <button
              title={showCommandSheet ? "Showing all commands" : "Refresh suggestions"}
              onMouseDown={handleLongPressStart}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={handleLongPressStart}
              onTouchEnd={handleLongPressEnd}
              onClick={handleRefreshClick}
              disabled={isLoading}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Refresh suggestions"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 transition-transform ${showCommandSheet ? "rotate-180 text-violet-600" : ""
                  }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-4 py-4 text-sm">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-violet-100 text-violet-600">
              <Image
                src="/genio/genio-avatar.png"
                alt="Genio AI"
                width={42}
                height={42}
                className="object-contain"
              />
            </div>
            <h3 className="text-base font-black text-slate-950">
              Ask Genio about HRPS records
            </h3>
            <p className="mt-2 max-w-xs text-sm text-slate-500">
              Try asking about employees, offices, counts, analytics, or workforce summaries.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
              }`}
          >
            <div
              className={`w-[min(82%,34rem)] break-words whitespace-pre-line rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm ${m.role === "user"
                ? "rounded-br-md bg-slate-950 text-white"
                : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                }`}
            >


              {m.content === THINKING_MESSAGE || m.content === EXPORTING_MESSAGE ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:0.3s]" />
                  </div>
                  <span className="italic">
                    {m.content === EXPORTING_MESSAGE
                      ? "Exporting Excel file..."
                      : messagesLoad[index]}
                  </span>
                </div>

              ) : m.role === "ai" ? (() => {
                const stats = extractStats(m.content);
                const displayContent = removeVisualizedStats(m.content, stats);
                const displayLines = displayContent.split("\n");
                const isLong = displayLines.length > MAX_VISIBLE_LINES;
                const isExpanded = expandedMessages[m.id];
                const visibleText =
                  isExpanded || !isLong
                    ? displayContent
                    : displayLines.slice(0, MAX_VISIBLE_LINES).join("\n");

                return (
                  <div>
                    {/* 📊 STAT CARD GOES HERE */}
                    {stats && (
                      <GenioStatCard
                        stats={stats}
                      />
                    )}
                    <div
                      className="
    prose prose-sm
    prose-p:my-1
    prose-ul:my-1
    prose-li:my-0
    prose-strong:text-slate-950
    prose-headings:mb-1
    prose-headings:mt-2
    max-w-none
  "
                    >
                      {visibleText ? <AnimatedMarkdown content={visibleText} /> : null}

                    </div>


                    {isLong && (
                      <button
                        onClick={() => toggleExpand(m.id)}
                        className="mt-1 text-xs font-semibold text-violet-600 hover:underline"
                      >
                        {isExpanded ? "See less ▲" : "See more ▼"}
                      </button>
                    )}
                  </div>
                );
              })() : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}

              {m.role === "ai" && m.canExport && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 mr-2"
                  disabled={isLoading}
                  onClick={() => sendMessage("Export this")}
                >
                  Export to Excel
                </Button>
              )}


              {m.role === "ai" && m.employeeId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={isLoading}
                  onClick={async () => {
                    const res = await fetch(
                      `/api/${departmentId}/employees/${m.employeeId}`
                    );

                    const emp = await res.json();
                    previewModal.onOpen(emp);
                  }}
                >
                  View Profile
                </Button>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>




      {/* INPUT */}
      <div className="border-t border-slate-200 bg-white p-3">



        <div
          className="relative flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-inner focus-within:border-violet-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100"
          onClick={() => inputRef.current?.focus()}
        >


          {/* ➕ PLUS */}
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-violet-600 disabled:pointer-events-none disabled:opacity-50"
            title="More options"
            disabled={isLoading}
          >
            <Plus className="h-5 w-5" />
          </button>


          {/* COMMANDS DROPDOWN */}
          {showCommands && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="custom-scrollbar max-h-48 overflow-y-auto py-1">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.value}
                    ref={(el) => (commandRefs.current[index] = el)}
                    type="button"
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm
            ${index === activeCommandIndex
                        ? "bg-violet-50 text-violet-700"
                        : "hover:bg-slate-50"}
            disabled:pointer-events-none disabled:opacity-50
          `}
                    disabled={isLoading}
                    onClick={() => {
                      setInput(cmd.template);
                      setShowCommands(false);
                      setActiveCommandIndex(0);
                      requestAnimationFrame(() =>
                        inputRef.current?.focus()
                      );
                    }}
                  >
                    <span className="font-mono text-xs text-violet-600">
                      {cmd.value}
                    </span>
                    <span className="text-slate-600">
                      {cmd.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}


          {/* TEXTAREA */}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder="Ask Genio anything..."
            disabled={isLoading}
            className="
        h-9 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-slate-800
        outline-none placeholder:text-slate-400
        disabled:cursor-not-allowed disabled:opacity-60
        max-h-28 overflow-hidden
      "
            onChange={(e) => {
              setInput(e.target.value);
              setShowCommands(e.target.value.trim().startsWith("/"));

              resizeTextarea();
            }}
            onKeyDown={(e) => {
              if (showCommands && filteredCommands.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveCommandIndex((i) =>
                    Math.min(i + 1, filteredCommands.length - 1)
                  );
                  return;
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveCommandIndex((i) => Math.max(i - 1, 0));
                  return;
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  const cmd = filteredCommands[activeCommandIndex];
                  if (cmd) {
                    setInput(cmd.template);
                    setShowCommands(false);
                  }
                  return;
                }

                if (e.key === "Tab") {
                  e.preventDefault();
                  const cmd = filteredCommands[activeCommandIndex];
                  if (cmd) {
                    setInput(cmd.template);
                    setShowCommands(false);
                  }
                  return;
                }
              }

              if (e.key === "Enter" && !e.shiftKey) {
                if (showCommands && filteredCommands.length > 0) {
                  e.preventDefault();
                  const cmd = filteredCommands[activeCommandIndex];
                  if (cmd) {
                    setInput(cmd.template);
                    setShowCommands(false);
                  }
                  return;
                }

                e.preventDefault();
                sendMessage();
              }

            }}
          />

          {/* 🎤 MIC */}
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-violet-600 disabled:pointer-events-none disabled:opacity-50"
            title="Voice input"
            disabled={isLoading}
          >
            <Mic className="h-5 w-5" />
          </button>

          {/* ⬆ SEND */}
          {!isLoading ? (
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              className="
      grid h-9 w-9 shrink-0 place-items-center
      rounded-full bg-slate-900 text-white
      transition hover:bg-violet-600
      disabled:cursor-not-allowed disabled:bg-slate-300
    "
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={stopGenerating}
              className="
      flex h-9 w-9 shrink-0 items-center justify-center
      rounded-full
      border border-black/10
      bg-white
      text-black
      transition
      hover:bg-black/5
    "
              title="Stop generating"
            >
              <Square className="h-4 w-4 fill-black" />
            </button>
          )}

        </div>


      </div>

      {showCommandSheet && (
        <div className="fixed inset-0 z-[120] bg-black/30">
          <div className="
      absolute bottom-0 left-0 right-0
      max-h-[70vh]
      rounded-t-2xl
      bg-white
      p-4
      shadow-xl
      overflow-y-auto
    ">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Example questions</h3>
              <button
                onClick={() => setShowCommandSheet(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            {Object.entries(COMMAND_GROUPS).map(([group, cmds]) => (
              <div key={group} className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {group}
                </p>

                <div className="space-y-1">
                  {cmds.map(cmd => (
                    <button
                      key={cmd.value}
                      className="
                  w-full rounded-lg px-3 py-2
                  text-left text-sm
                  hover:bg-muted
                "
                      onClick={() => {
                        handleChipClick(cmd);
                        setShowCommandSheet(false);
                      }}
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="border-t border-slate-200 bg-white px-4 py-2 text-center">
        <div className="flex justify-center gap-3">
          <button className="text-[11px] text-slate-500 transition hover:text-slate-700">
            Genio AI can make mistakes. Check important HR records.
          </button>

        </div>
      </div>
      {selectionRect && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(selectionText);
            setSelectionText("");
            setSelectionRect(null);
            window.getSelection()?.removeAllRanges();
          }}
          className="
      fixed z-50
      rounded-md border bg-white px-3 py-1.5
      text-xs font-medium
      shadow-md
      hover:bg-muted
    "
          style={{
            top: selectionRect.top - 36,
            left: selectionRect.left + selectionRect.width / 2,
            transform: "translateX(-50%)",
          }}
        >
          Copy
        </button>
      )}


    </div>
  );
};
