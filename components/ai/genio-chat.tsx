"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type GenioMessage = {
  role: "user" | "ai";
  content: string;
};

type GenioContext = {
  employeeTypeId?: string;
  employeeTypeName?: string;
  year?: number;
};

export const GenioChat = () => {
  const [messages, setMessages] = useState<GenioMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastContext, setLastContext] = useState<GenioContext | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const messageToSend = input;

    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setInput("");
    setIsLoading(true);

    // loader
    setMessages((prev) => [
      ...prev,
      { role: "ai", content: "__thinking__:Searching employee records..." },
    ]);

    try {
      const res = await fetch("/api/genio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          context: lastContext,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      let aiText = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        aiText += decoder.decode(value);

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "ai",
            content: aiText,
          };
          return updated;
        });
      }

      // context comes via headers
      const contextHeader = res.headers.get("x-genio-context");
      if (contextHeader) {
        setLastContext(JSON.parse(contextHeader));
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          content: "Something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[420px] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            {m.content.startsWith("__thinking__") ? (
              <div className="space-y-1">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.content.replace("__thinking__:", "")}
                </p>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Genio..."
          disabled={isLoading}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          {isLoading ? "Thinking..." : "Send"}
        </Button>
      </div>
    </div>
  );
};
