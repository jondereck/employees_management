"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import usePreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/hooks/use-preview-modal";
import { FiMaximize2, FiMinimize, FiMinimize2, FiRefreshCcw } from "react-icons/fi";

import {
  loadGenioCache,
  saveGenioCache,
  clearGenioCache,
} from "@/lib/genio-cache";


import { nanoid } from "nanoid";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";


type GenioMessage = {
  id: string;
  role: "user" | "ai";

  content: string;
  employeeId?: string;
  canExport?: boolean;
};

type GenioContext = {
  employeeTypeId?: string;
  employeeTypeName?: string;
  year?: number;
};

const GENIO_COMMANDS = [
  /* ================= EMPLOYEES ================= */

  {
    label: "Who is an employee",
    value: "/whois",
    template: "Who is ",
  },
  {
    label: "Check if employee is office head",
    value: "/ishead",
    template: "Is [name] the head of [office]?",
  },

  /* ================= COUNTS ================= */

  {
    label: "Total employees",
    value: "/count",
    template: "How many employees are there?",
  },
  {
    label: "Count by gender",
    value: "/count-gender",
    template: "How many female employees are there?",
  },
  {
    label: "Count by employee type",
    value: "/count-type",
    template: "How many regular employees are there?",
  },

  /* ================= LISTS ================= */

  {
    label: "List all employees",
    value: "/list",
    template: "List all employees",
  },
  {
    label: "List all offices",
    value: "/offices",
    template: "List all offices",
  },
  {
    label: "List office heads",
    value: "/list-heads",
    template: "List all office heads",
  },
  {
    label: "Offices without head",
    value: "/no-head",
    template: "Which offices don’t have a head?",
  },

  /* ================= OFFICES ================= */

  {
    label: "Head of an office",
    value: "/head",
    template: "Who is the head of ",
  },

  /* ================= ANALYTICS ================= */

  {
    label: "Employee distribution",
    value: "/distribution",
    template: "Show employee distribution",
  },
  {
    label: "Employee insights",
    value: "/insight",
    template: "Give me insights about employees",
  },
];



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
  const [lastContext, setLastContext] = useState<GenioContext | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<
    Record<string, boolean>
  >({});
  const [showCommands, setShowCommands] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);




  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messagesLoad.length);
    }, 2000); // change every 2 seconds

    return () => clearInterval(interval);
  }, []);


  const inputRef = useRef<HTMLInputElement | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  /* ================= SEND MESSAGE ================= */

  const sendMessage = async (preset?: string) => {
    const text = preset ?? input;
    if (!text.trim() || isLoading) return;

    setInput("");
    setIsLoading(true);

    const userMsg: GenioMessage = {
      id: nanoid(),
      role: "user",
      content: text,
    };

    const aiId = nanoid();

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: aiId, role: "ai", content: "__thinking__" },
    ]);

    try {
      const res = await fetch("/api/genio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: lastContext,
        }),
      });

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
         🧠 CONTEXT
         =============================== */
      const ctx = res.headers.get("x-genio-context");
      if (ctx) {
        try {
          setLastContext(JSON.parse(ctx));
        } catch (e) {
          console.error("Failed to parse genio context", e);
        }
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
          m.role === "ai" && m.content === "__thinking__"
            ? { ...m, content: "Something went wrong." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    if (typeof window === "undefined") return;

    const cached = loadGenioCache();
    if (!cached) return;

    setMessages(cached.messages ?? []);
    setLastContext(cached.context ?? null);
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
        context: lastContext,
        input,
      });
    }, 300);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [messages, lastContext, input]);


  const MAX_VISIBLE_LINES = 8;

  const toggleExpand = (id: string) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredCommands = GENIO_COMMANDS.filter(cmd =>
    cmd.value.startsWith(input)
  );




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
          {/* Fullscreen*/}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
          </button>

          {/* Reset*/}

          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              clearGenioCache();
              setMessages([]);
              setLastContext(null);
              setInput("");
            }}
          >
            <FiRefreshCcw className="h-4 w-4" />
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
      {lastContext && (
        <div className="border-b bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Context:</span>{" "}
          {lastContext.employeeTypeName && (
            <>Employee Type: {lastContext.employeeTypeName}</>
          )}
          {lastContext.year && <> · Year: {lastContext.year}</>}
        </div>
      )}

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

                return (
                  <div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {visibleText}
                    </ReactMarkdown>

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
              {m.role === "ai" && m.content !== "__thinking__" && (
                <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
                  <button
                    onClick={() => navigator.clipboard.writeText(m.content)}
                    className="hover:text-foreground"
                  >
                    📋 Copy
                  </button>

                  <button
                    className="hover:text-foreground"
                    onClick={() => sendMessage("Why did you answer this?")}
                  >
                    🧠 Why?
                  </button>
                </div>
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
      <div className="relative border-t border-white/10 px-3 py-2">


        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-2 py-1">

          {showCommands && (

            <div className="absolute bottom-full left-3 right-3 mb-2 z-50 rounded-lg border bg-background shadow-lg">
              <div className="max-h-48 overflow-y-auto">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.value}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm
      ${index === activeCommandIndex ? "bg-muted" : "hover:bg-muted"}
    `}
                    onClick={() => {
                      setInput(cmd.template);
                      setShowCommands(false);
                      setActiveCommandIndex(0); // reset
                      inputRef.current?.focus();
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

          <Input

            ref={inputRef}
            className="
    h-10
    px-3
    text-sm
    border-0
    bg-transparent
    focus-visible:ring-0
    focus-visible:ring-offset-0
    placeholder:text-muted-foreground
  "
            placeholder="Ask Genio anything..."
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              setShowCommands(val.startsWith("/"));
            }}

            onKeyDown={(e) => {
              if (showCommands && filteredCommands.length > 0) {
                // TAB → select command
                if (e.key === "Tab") {
                  e.preventDefault();
                  const cmd = filteredCommands[activeCommandIndex];
                  if (cmd) {
                    setInput(cmd.template);
                    setShowCommands(false);
                    inputRef.current?.focus();
                  }
                  return;
                }

                // ↓ Arrow
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveCommandIndex((i) =>
                    Math.min(i + 1, filteredCommands.length - 1)
                  );
                  return;
                }

                // ↑ Arrow
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveCommandIndex((i) =>
                    Math.max(i - 1, 0)
                  );
                  return;
                }
              }

              // ENTER → send message
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
                setShowCommands(false); // 👈 close menu after sending
              }
            }}

            disabled={isLoading}
          />

          <Button
            size="sm"
            className="
        h-6
        rounded-md
        px-2
        text-[11px]
      "
            onClick={() => sendMessage()}
            disabled={isLoading}
          >
            Send →
          </Button>
        </div>
        {/* QUICK ACTIONS */}

        <div className="mt-2 flex gap-2">

          <button
            className="flex-1 rounded-md bg-muted/60 px-2 py-1 text-[11px] hover:bg-muted transition"
            onClick={() => sendMessage('How many employees are there?')}
          >
            Total Employees
          </button>

          <button
            className="flex-1 rounded-md bg-muted/60 px-2 py-1 text-[11px] hover:bg-muted transition"
            onClick={() => sendMessage('How many female employees are there?')}
          >
            Female Count
          </button>

          <Button
            size="sm"
            variant="ghost"
            className="mt-2 text-xs text-red-500"
            onClick={() => {
              clearGenioCache();
              setMessages([]);
              setLastContext(null);
              setInput("");
            }}
          >
            Clear Memory
          </Button>

        </div>

      </div>
      {/* FOOTER */}
      <div className="border-t border-black/10 px-4 py-2 text-center text-[11px] text-black">
        <div className="flex justify-center gap-3">
          <button className="hover:text-black/80 transition">
            Privacy
          </button>
          <span className="text-black/40">·</span>
          <button className="hover:text-black/80 transition">
            Terms
          </button>
          <span className="text-black/40">·</span>
          <button className="hover:text-black/80 transition">
            Feedback
          </button>
        </div>
      </div>


    </div>
  );
};
