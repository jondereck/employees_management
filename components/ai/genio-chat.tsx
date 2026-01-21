"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import usePreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/hooks/use-preview-modal";

import { nanoid } from "nanoid";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";


type GenioMessage = {
  id: string;
  role: "user" | "ai";

  content: string;
  employeeId?: string;
};

type GenioContext = {
  employeeTypeId?: string;
  employeeTypeName?: string;
  year?: number;
};
export const GenioChat = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const previewModal = usePreviewModal();



  const [messages, setMessages] = useState<GenioMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastContext, setLastContext] = useState<GenioContext | null>(null);


  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);



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
        body: JSON.stringify({ message: text }),
      });

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

      const meta = res.headers.get("x-genio-meta");
      if (meta) {
        const parsed = JSON.parse(meta);
        if (parsed.viewProfileEmployeeId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, employeeId: parsed.viewProfileEmployeeId }
                : m
            )
          );
        }
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



  return (
    <div className="flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">

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
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

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
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                </div>
              ) : m.role === "ai" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}

              {m.role === "ai" && m.employeeId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={async () => {
                    const res = await fetch(
                      `/api/employees/${m.employeeId}`
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
      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2">
          <Input
            className="border-0 bg-transparent focus-visible:ring-0"
            placeholder="Ask Genio anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={isLoading}
          />
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => sendMessage()}
            disabled={isLoading}
          >
            Send →
          </Button>
        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-3 flex gap-2">
          <button
            className="flex-1 rounded-full bg-muted px-3 py-1 text-xs"
            onClick={() => sendMessage("How many employees are there?")}
          >
            Total Employees
          </button>
          <button
            className="flex-1 rounded-full bg-muted px-3 py-1 text-xs"
            onClick={() => sendMessage("How many female employees are there?")}
          >
            Female Count
          </button>
          <button
            className="flex-1 rounded-full bg-muted px-3 py-1 text-xs"
            onClick={() => sendMessage("Show HR department details")}
          >
            HR Details
          </button>
        </div>
      </div>
    </div>
  );
};
