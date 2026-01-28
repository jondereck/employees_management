// components/AnimatedMarkdown.tsx
"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatGenioMessage } from "../utils";


export function AnimatedMarkdown({
  content,
  speed = 120,
}: {
  content: string;
  speed?: number;
}) {
  const lines = formatGenioMessage(content).split("\n");
  const [visibleLines, setVisibleLines] = useState(1);

  useEffect(() => {
    if (visibleLines >= lines.length) return;

    const t = setTimeout(() => {
      setVisibleLines((v) => v + 1);
    }, speed);

    return () => clearTimeout(t);
  }, [visibleLines, lines.length, speed]);

  return (
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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {lines.slice(0, visibleLines).join("\n")}
      </ReactMarkdown>
    </div>
  );
}
