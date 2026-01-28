"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import usePreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/hooks/use-preview-modal";
import { FiMaximize, FiMaximize2, FiMinimize, FiMinimize2, FiRefreshCcw } from "react-icons/fi";

import {
  loadGenioCache,
  saveGenioCache,
  clearGenioCache,
} from "@/lib/genio-cache";


import { nanoid } from "nanoid";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import { ArrowUp, Mic, Plus, Square, Trash } from "lucide-react";
import { extractStats, formatGenioMessage } from "@/src/genio/utils";
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
  employeeTypeId?: string;
  employeeTypeName?: string;
  year?: number;
};
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
    label: "Show employee profile",
    value: "/profile",
    template: "Show profile",
    quickChip: true,
    examples: [
      "Show profile",
      "Ipakita ang profile",
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
    template: "Who is the head of [office]?",
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
    template: "How many [employee type] employees are there?",
    quickChip: true,
    examples: [
      "How many regular employees?",
      "Ilan ang COS?",
    ],
  },

  /* ================= LISTING ================= */

  {
    label: "List employees from last count",
    value: "/list",
    template: "List them",
    quickChip: true,
    examples: [
      "List them",
      "Ilista sila",
    ],
  },

  {
    label: "List employees from last result",
    value: "/list-last",
    template: "Show employees from last count",
    quickChip: true,
    examples: [
      "Show employees from last count",
      "Sino-sino yung nasa bilang?",
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

  {
    label: "Age analysis",
    value: "/age",
    template: "How many employees are [above/below] [age]?",
    quickChip: true,
    examples: [
      "How many employees above 40?",
      "Ilan ang below 30?",
    ],
  },

  {
    label: "Tenure analysis",
    value: "/tenure",
    template: "How many employees have more than [years] years of service?",
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

  /* ================= EXPORT ================= */

  {
    label: "Export last result",
    value: "/export",
    template: "Export this to Excel",
    examples: [
      "Export this",
      "I-export ang data",
    ],
  },

  /* ================= AI / GENERAL ================= */

  {
    label: "Ask Genio (AI)",
    value: "/ask",
    template: "Ask a general HR question",
    examples: [
      "Why is workforce balance important?",
      "Ano ang ibig sabihin ng understaffed?",
    ],
  },
];

const isMobile = typeof window !== "undefined" &&
  window.matchMedia("(max-width: 640px)").matches;



  const COMMAND_GROUPS = {
  Employees: GENIO_COMMANDS.filter(c =>
    ["whois", "profile", "ishead"].includes(c.value.replace("/", ""))
  ),
  Offices: GENIO_COMMANDS.filter(c =>
    c.value.includes("office")
  ),
  Counts: GENIO_COMMANDS.filter(c =>
    c.value.includes("count")
  ),
  Analytics: GENIO_COMMANDS.filter(c =>
    ["distribution", "age", "tenure", "insight"].some(k =>
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
  hidden
}: {

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




  /* ================= SEND MESSAGE ================= */

  const sendMessage = async (preset?: string) => {
    const text = preset ?? input;
    if (!text.trim() || isLoading) return;

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

    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: aiId,
        role: "ai",
        content: "__thinking__",
        context: undefined, // 👈 add this
      },
    ]);

    const lastAIContext =
      [...messages]
        .reverse()
        .find((m) => m.role === "ai" && m.context)?.context ?? null;
    try {
      const res = await fetch("/api/genio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: lastAIContext,
        }),

        signal: controller.signal,
      });

      const ctx = res.headers.get("x-genio-context");

      if (ctx) {
        try {
          const parsed = JSON.parse(ctx);

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
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "employees-export.xlsx";
        a.click();

        window.URL.revokeObjectURL(url);

        setMessages((prev) =>
          prev.filter((m) => m.id !== aiId)
        );

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
      console.log("CTX HEADER:", res.headers.get("x-genio-context"));

    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.role === "ai" && m.content === "__thinking__"
            ? { ...m, content: "Something went wrong." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      readerRef.current = null;
    }
  };



  useEffect(() => {
    if (typeof window === "undefined") return;

    const cached = loadGenioCache();
    if (!cached) return;

    setMessages(cached.messages ?? []);

    setInput(cached.input ?? "");
  }, []);

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {

    if (typeof window === "undefined") return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      console.log("CACHE SAVE CONFIRMED", messages.length);
      saveGenioCache({
        messages,
        input,
      });
    }, 300);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [messages, input]);


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

  const latestAIContext =
    [...messages]
      .reverse()
      .find((m) => m.role === "ai" && m.context)?.context;



  return (
    <div
      className={`
    flex flex-col overflow-hidden border bg-background shadow-2xl
    transition-all duration-300
    ${hidden ? "hidden" : ""}

    ${isFullscreen
          ? "fixed inset-0 z-[100] h-screen w-screen rounded-none"
          : "rounded-2xl h-[100dvh] w-full sm:h-[520px] sm:w-[380px]"
        }
  `}
    >




      {/* HEADER */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">


          <div className="relative h-12 w-12 overflow-hidden rounded-full bg-purple-300">

            <Image
              src="/genio/genio-avatar.png"
              alt="Genio AI"
              fill
              className="rounded-full object-contain"
              priority
            />
          </div>

          <div>
            <p className="text-sm font-semibold">Genio</p>
            <p className="flex items-center gap-1 text-xs text-green-500">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Online
            </p>
          </div>
        </div>

        <div className="flex gap-2">


          {/* Reset*/}

          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              clearGenioCache();
              setMessages([]);

              setInput("");
            }}
          >
            <Trash className="h-4 w-4 text-red-500 hover:text-red-700" />
          </button>
          {/* Fullscreen*/}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isFullscreen ? <FiMinimize /> : <FiMaximize />}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="Close"
          >
            ✕
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



      {/* MESSAGES */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 text-sm">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground">
            Ask Genio anything about your employees.
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
              }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
                }`}
            >


              {m.content === "__thinking__" ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0.3s]" />
                  </div>
                  <span className="italic">{messagesLoad[index]}</span>
                </div>

              ) : m.role === "ai" ? (() => {
                const lines = m.content.split("\n");
                const isLong = lines.length > MAX_VISIBLE_LINES;
                const isExpanded = expandedMessages[m.id];

                const visibleText =
                  isExpanded || !isLong
                    ? m.content
                    : lines.slice(0, MAX_VISIBLE_LINES).join("\n");

                     const stats = extractStats(m.content);
                return (
                  <div>
                    {/* 📊 STAT CARD GOES HERE */}
      {stats && (
        <GenioStatCard
          total={stats.total}
          male={stats.male}
          female={stats.female}
        />
      )}
                    <div
                      className="
    prose prose-sm
    prose-p:my-1
    prose-ul:my-1
    prose-li:my-0
    prose-strong:text-foreground
    prose-headings:mb-1
    prose-headings:mt-2
    max-w-none
  "
                    >
                     <AnimatedMarkdown content={visibleText} />

                    </div>


                    {isLong && (
                      <button
                        onClick={() => toggleExpand(m.id)}
                        className="mt-1 text-xs text-primary hover:underline"
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
      <div className="border-t bg-background px-3 py-3">
        {/* QUICK COMMAND CHIPS */}
    {visibleChips.length > 0 && (
  <div className="mb-2 flex items-center justify-between gap-2">
    {/* LEFT: COMMAND CHIPS */}
    <div className="flex flex-wrap gap-2">
      {visibleChips.map((cmd) => (
        <button
          key={cmd.value}
          className="
            rounded-full border px-3 py-1
            text-xs text-muted-foreground
            hover:bg-muted transition
          "
          onClick={() => handleChipClick(cmd)}
        >
          {cmd.label}
        </button>
      ))}
    </div>

    {/* RIGHT: REFRESH BUTTON */}
    <button
  title={showCommandSheet ? "Showing all commands" : "Refresh suggestions"}
  onMouseDown={handleLongPressStart}
  onMouseUp={handleLongPressEnd}
  onMouseLeave={handleLongPressEnd}
  onTouchStart={handleLongPressStart}
  onTouchEnd={handleLongPressEnd}
  onClick={handleRefreshClick}
  className="
    flex h-7 w-7 items-center justify-center
    rounded-full border
    text-muted-foreground
    hover:bg-muted hover:text-foreground
    transition
    active:scale-95
  "
>
  <FiRefreshCcw
    className={`h-3.5 w-3.5 transition-transform ${
      showCommandSheet ? "rotate-180 text-primary" : ""
    }`}
  />
</button>

  </div>
)}

{showCommandSheet && (
  <p className="mt-1 text-[10px] text-muted-foreground">
    Long-press 🔄 to toggle suggestions
  </p>
)}



        <div
          className="relative flex items-center gap-2 rounded-full border bg-white px-3 py-2 shadow-sm"
          onClick={() => inputRef.current?.focus()}
        >


          {/* ➕ PLUS */}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            title="More options"
          >
            <Plus className="h-5 w-5" />
          </button>


          {/* COMMANDS DROPDOWN */}
          {showCommands && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border bg-white shadow-lg">
              <div className="max-h-48 overflow-y-auto py-1">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.value}
                    ref={(el) => (commandRefs.current[index] = el)}
                    type="button"
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm
            ${index === activeCommandIndex
                        ? "bg-muted"
                        : "hover:bg-muted"}
          `}
                    onClick={() => {
                      setInput(cmd.template);
                      setShowCommands(false);
                      setActiveCommandIndex(0);
                      requestAnimationFrame(() =>
                        inputRef.current?.focus()
                      );
                    }}
                  >
                    <span className="font-mono text-xs text-primary">
                      {cmd.value}
                    </span>
                    <span className="text-muted-foreground">
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
            placeholder="Ask anything"
            disabled={isLoading && messages.length > 0}
            className="
        flex-1 resize-none bg-transparent text-sm
        outline-none placeholder:text-muted-foreground
        max-h-[120px] overflow-y-auto
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
            className="text-muted-foreground hover:text-foreground"
            title="Voice input"
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
      flex h-8 w-8 items-center justify-center
      rounded-full bg-black text-white
      transition hover:opacity-90
      disabled:opacity-40
    "
              title="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={stopGenerating}
              className="
      flex h-9 w-9 items-center justify-center
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
        <h3 className="text-sm font-semibold">What can Genio do?</h3>
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
      <div className="border-t border-black/10 px-4 py-2 text-center text-[11px] text-black">
        <div className="flex justify-center gap-3 italic">
          <button className="hover:text-black/80 transition">
            Genio AI can make mistakes. Check important info.
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
